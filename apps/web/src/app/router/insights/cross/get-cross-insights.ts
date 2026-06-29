import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export type CrossInsightSeverity = "good" | "warn" | "bad" | "neutral";

export interface CrossInsightTile {
  tileId: string;
  title: string;
  primaryValue: number;
  secondaryValue?: number;
  delta: number | null;
  trend: "up" | "down" | "flat";
  severity: CrossInsightSeverity;
  narrative: string;
  topContributor?: string;
  unit?: "count" | "percent" | "currency";
}

export const getCrossInsights = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      dateRange: z
        .object({
          from: z.string().or(z.date()).optional(),
          to: z.string().or(z.date()).optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const now = new Date();
    const to = input.dateRange?.to ? new Date(input.dateRange.to) : now;
    const fromDefault = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = input.dateRange?.from
      ? new Date(input.dateRange.from)
      : fromDefault;
    const rangeMs = Math.max(to.getTime() - from.getTime(), 1);
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - rangeMs);

    const tiles: CrossInsightTile[] = [];

    const trackings = await prisma.tracking.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const trackingIds = trackings.map((t) => t.id);

    if (trackingIds.length > 0) {
      const [
        leadsCurrent,
        leadsPrev,
        wonCurrent,
        wonPrev,
        msgCurrent,
        msgPrev,
      ] = await Promise.all([
        prisma.lead.count({
          where: {
            trackingId: { in: trackingIds },
            createdAt: { gte: from, lte: to },
          },
        }),
        prisma.lead.count({
          where: {
            trackingId: { in: trackingIds },
            createdAt: { gte: prevFrom, lte: prevTo },
          },
        }),
        prisma.lead.count({
          where: {
            trackingId: { in: trackingIds },
            currentAction: "WON",
            closedAt: { gte: from, lte: to },
          },
        }),
        prisma.lead.count({
          where: {
            trackingId: { in: trackingIds },
            currentAction: "WON",
            closedAt: { gte: prevFrom, lte: prevTo },
          },
        }),
        prisma.message.count({
          where: {
            fromMe: true,
            createdAt: { gte: from, lte: to },
            conversation: { trackingId: { in: trackingIds } },
          },
        }),
        prisma.message.count({
          where: {
            fromMe: true,
            createdAt: { gte: prevFrom, lte: prevTo },
            conversation: { trackingId: { in: trackingIds } },
          },
        }),
      ]);

      const conversionCurrent =
        leadsCurrent === 0 ? 0 : (wonCurrent / leadsCurrent) * 100;
      const conversionPrev =
        leadsPrev === 0 ? 0 : (wonPrev / leadsPrev) * 100;
      const convDelta =
        conversionPrev === 0
          ? null
          : conversionCurrent - conversionPrev;

      tiles.push({
        tileId: "tracking-conversion",
        title: "Conversão de leads",
        primaryValue: Math.round(conversionCurrent * 10) / 10,
        secondaryValue: Math.round(conversionPrev * 10) / 10,
        delta: convDelta,
        trend: severityTrend(convDelta),
        severity: convSeverity(convDelta),
        narrative: buildConversionNarrative(
          leadsCurrent,
          wonCurrent,
          conversionCurrent,
          conversionPrev,
        ),
        unit: "percent",
      });

      const msgPerLeadCurrent =
        leadsCurrent === 0 ? 0 : msgCurrent / leadsCurrent;
      const msgPerLeadPrev = leadsPrev === 0 ? 0 : msgPrev / leadsPrev;
      const msgDelta =
        msgPerLeadPrev === 0
          ? null
          : ((msgPerLeadCurrent - msgPerLeadPrev) / msgPerLeadPrev) * 100;

      tiles.push({
        tileId: "chat-engagement",
        title: "Mensagens por lead",
        primaryValue: Math.round(msgPerLeadCurrent * 10) / 10,
        secondaryValue: Math.round(msgPerLeadPrev * 10) / 10,
        delta: msgDelta,
        trend: severityTrend(msgDelta),
        severity: msgSeverity(msgDelta),
        narrative: buildEngagementNarrative(
          msgCurrent,
          leadsCurrent,
          msgPerLeadCurrent,
          msgPerLeadPrev,
        ),
        unit: "count",
      });
    }

    const [actionsDoneCurrent, actionsDonePrev, actionsOverdue] =
      await Promise.all([
        prisma.action.count({
          where: {
            organizationId: orgId,
            isDone: true,
            closedAt: { gte: from, lte: to },
          },
        }),
        prisma.action.count({
          where: {
            organizationId: orgId,
            isDone: true,
            closedAt: { gte: prevFrom, lte: prevTo },
          },
        }),
        prisma.action.count({
          where: {
            organizationId: orgId,
            isDone: false,
            dueDate: { lt: now },
          },
        }),
      ]);

    const actionsDelta =
      actionsDonePrev === 0
        ? null
        : ((actionsDoneCurrent - actionsDonePrev) / actionsDonePrev) * 100;

    tiles.push({
      tileId: "workspace-throughput",
      title: "Ações concluídas",
      primaryValue: actionsDoneCurrent,
      secondaryValue: actionsDonePrev,
      delta: actionsDelta,
      trend: severityTrend(actionsDelta),
      severity:
        actionsOverdue > actionsDoneCurrent
          ? "bad"
          : msgSeverity(actionsDelta),
      narrative:
        actionsOverdue > 0
          ? `${actionsOverdue} ação(ões) em atraso bloqueando o ritmo da operação.`
          : actionsDelta == null
            ? `${actionsDoneCurrent} ações concluídas no período. Sem dados anteriores para comparar.`
            : actionsDelta >= 0
              ? `Ritmo operacional acima do período anterior em ${Math.abs(actionsDelta).toFixed(0)}%.`
              : `Ritmo caiu ${Math.abs(actionsDelta).toFixed(0)}% versus o período anterior — checar gargalos no Workspace.`,
      unit: "count",
    });

    const [revenueCurrentAgg, revenuePrevAgg] = await Promise.all([
      prisma.paymentEntry.aggregate({
        _sum: { paidAmount: true },
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
      }),
      prisma.paymentEntry.aggregate({
        _sum: { paidAmount: true },
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          status: "PAID",
          paidAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    const revenueCurrent = (revenueCurrentAgg._sum.paidAmount ?? 0) / 100;
    const revenuePrev = (revenuePrevAgg._sum.paidAmount ?? 0) / 100;
    const revenueDelta =
      revenuePrev === 0
        ? null
        : ((revenueCurrent - revenuePrev) / revenuePrev) * 100;

    if (revenueCurrent > 0 || revenuePrev > 0) {
      tiles.push({
        tileId: "payment-revenue",
        title: "Faturamento bruto",
        primaryValue: revenueCurrent,
        secondaryValue: revenuePrev,
        delta: revenueDelta,
        trend: severityTrend(revenueDelta),
        severity: convSeverity(revenueDelta),
        narrative:
          revenueDelta == null
            ? `Faturamento de ${formatCurrency(revenueCurrent)} no período.`
            : revenueDelta > 0
              ? `Faturamento subiu ${revenueDelta.toFixed(0)}% — total de ${formatCurrency(revenueCurrent)}.`
              : `Faturamento caiu ${Math.abs(revenueDelta).toFixed(0)}% — investigar inadimplência e cancelamentos.`,
        unit: "currency",
      });
    }

    return { tiles, dateRange: { from, to }, prevRange: { from: prevFrom, to: prevTo } };
  });

function severityTrend(delta: number | null): "up" | "down" | "flat" {
  if (delta == null || Math.abs(delta) < 0.5) return "flat";
  return delta > 0 ? "up" : "down";
}

function convSeverity(delta: number | null): CrossInsightSeverity {
  if (delta == null) return "neutral";
  if (delta <= -30) return "bad";
  if (delta >= 50) return "good";
  if (delta < 0) return "warn";
  return "neutral";
}

function msgSeverity(delta: number | null): CrossInsightSeverity {
  if (delta == null) return "neutral";
  if (delta < -20) return "warn";
  if (delta > 20) return "good";
  return "neutral";
}

function buildConversionNarrative(
  leads: number,
  won: number,
  current: number,
  prev: number,
): string {
  if (leads === 0) return "Nenhum lead recebido no período.";
  if (prev === 0) {
    return `Conversão de ${current.toFixed(1)}% — ${won} de ${leads} leads ganhos.`;
  }
  const diff = current - prev;
  if (Math.abs(diff) < 0.5) {
    return `Conversão estável (${current.toFixed(1)}%) — ${won} ganhos.`;
  }
  if (diff < 0) {
    return `Conversão caiu ${Math.abs(diff).toFixed(1)}pp. Revisar follow-up e tempo médio de resposta.`;
  }
  return `Conversão subiu ${diff.toFixed(1)}pp — boa eficiência do funil.`;
}

function buildEngagementNarrative(
  msgs: number,
  leads: number,
  current: number,
  prev: number,
): string {
  if (leads === 0) return "Sem leads para medir engajamento.";
  if (prev === 0) {
    return `${msgs} mensagens enviadas / ${current.toFixed(1)} por lead.`;
  }
  if (current < prev) {
    return `Engajamento caiu — ${current.toFixed(1)} vs ${prev.toFixed(1)} mensagens por lead.`;
  }
  return `${current.toFixed(1)} mensagens por lead, acima de ${prev.toFixed(1)} no período anterior.`;
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}
