import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroChartPayload } from "@/features/astro/lib/astro-chart";
import { resolveTargetOrgs } from "@/features/astro/server/tools/shared/resolve-target-orgs";

/**
 * Tools de GRÁFICO — retornam payloads `kind:"astro_chart"` que o cliente
 * renderiza com recharts (bar/line/pie). Use quando o user pedir
 * visualização ("gráfico de X", "mostra visualmente", "tendência").
 *
 * Cada tool faz a query agregada + monta o payload pronto pra renderer.
 * Sem agg client-side.
 */
export function buildChartTools(ctx: AgentContext) {
  return {
    // ── BAR: top colaboradores que criaram agendamentos ──────────────────
    chart_appointment_creators: tool({
      description:
        "Gráfico de BARRAS — top colaboradores que criaram agendamentos no período. Use quando o user pedir 'gráfico de quem mais marcou reuniões', 'visualiza atendentes', 'ranking gráfico'. Mesma fonte da list_appointment_creators, mas formato visual.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        limit: z.number().int().min(2).max(15).optional(),
      }),
      execute: async ({ orgIds, fromIso, toIso, limit }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }
        // Default = últimos 90 dias (era 30) — 30 é restritivo demais
        // pra perguntas tipo "top atendentes" onde o user pode ter
        // criado a maioria há mais tempo.
        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const grouped = await prisma.appointment.groupBy({
          by: ["userId"],
          where: {
            agenda: { organizationId: { in: targetOrgs } },
            startsAt: { gte: from, lte: to },
          },
          _count: { _all: true },
        });

        console.log(
          `[astro/chart_appointment_creators] orgs=${targetOrgs.length} from=${from.toISOString()} to=${to.toISOString()} grouped.length=${grouped.length}`,
        );

        const userIds = grouped
          .map((g) => g.userId)
          .filter((id): id is string => id !== null);
        const users =
          userIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true },
              })
            : [];
        const map = new Map(users.map((u) => [u.id, u.name]));

        const data = grouped
          .map((g) => ({
            label: g.userId
              ? map.get(g.userId) ?? "(removido)"
              : "(sem criador)",
            value: g._count._all,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, limit ?? 10);

        // FALLBACK: se nada no período, tenta SEM filtro de data pra
        // mostrar pelo menos os top all-time.
        let fallbackUsed = false;
        if (data.length === 0) {
          const allTime = await prisma.appointment.groupBy({
            by: ["userId"],
            where: { agenda: { organizationId: { in: targetOrgs } } },
            _count: { _all: true },
          });
          const allIds = allTime
            .map((g) => g.userId)
            .filter((id): id is string => id !== null);
          const allUsers =
            allIds.length > 0
              ? await prisma.user.findMany({
                  where: { id: { in: allIds } },
                  select: { id: true, name: true },
                })
              : [];
          const allMap = new Map(allUsers.map((u) => [u.id, u.name]));
          const allData = allTime
            .map((g) => ({
              label: g.userId
                ? allMap.get(g.userId) ?? "(removido)"
                : "(sem criador)",
              value: g._count._all,
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit ?? 10);
          if (allData.length > 0) {
            data.push(...allData);
            fallbackUsed = true;
          }
        }

        const payload: AstroChartPayload = {
          kind: "astro_chart",
          chartType: "bar",
          title: "Agendamentos por colaborador",
          caption: fallbackUsed
            ? "Sem dados no período recente — mostrando histórico completo."
            : `Período ${from.toLocaleDateString("pt-BR")} a ${to.toLocaleDateString("pt-BR")}`,
          xLabel: "Colaborador",
          yLabel: "Agendamentos",
          data,
          valueFormat: "number",
        };
        return payload;
      },
    }),

    // ── PIE: propostas Forge por status ──────────────────────────────────
    chart_forge_proposals_by_status: tool({
      description:
        "Gráfico de PIZZA — distribuição de propostas Forge por status (rascunho/enviada/visualizada/paga/expirada/cancelada). Use pra 'gráfico de propostas', 'visualizar status das propostas'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
      }),
      execute: async ({ orgIds, fromIso, toIso }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }
        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const grouped = await prisma.forgeProposal.groupBy({
          by: ["status"],
          where: {
            organizationId: { in: targetOrgs },
            createdAt: { gte: from, lte: to },
          },
          _count: { _all: true },
        });

        const labelMap: Record<string, string> = {
          RASCUNHO: "Rascunho",
          ENVIADA: "Enviada",
          VISUALIZADA: "Visualizada",
          PAGA: "Paga",
          EXPIRADA: "Expirada",
          CANCELADA: "Cancelada",
        };
        const data = grouped
          .map((g) => ({
            label: labelMap[g.status] ?? g.status,
            value: g._count._all,
          }))
          .filter((d) => d.value > 0);

        const payload: AstroChartPayload = {
          kind: "astro_chart",
          chartType: "pie",
          title: "Propostas Forge por status",
          caption: `Período ${from.toLocaleDateString("pt-BR")} a ${to.toLocaleDateString("pt-BR")}`,
          data,
          valueFormat: "number",
        };
        return payload;
      },
    }),

    // ── PIE: agendamentos por status ─────────────────────────────────────
    chart_appointments_by_status: tool({
      description:
        "Gráfico de PIZZA — distribuição de agendamentos por status (pendente/confirmado/realizado/cancelado/no-show). Use pra 'gráfico de agendamentos', 'visualizar comparecimento'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
      }),
      execute: async ({ orgIds, fromIso, toIso }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }
        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const grouped = await prisma.appointment.groupBy({
          by: ["status"],
          where: {
            agenda: { organizationId: { in: targetOrgs } },
            startsAt: { gte: from, lte: to },
          },
          _count: { _all: true },
        });

        const labelMap: Record<string, string> = {
          PENDING: "Pendente",
          CONFIRMED: "Confirmado",
          DONE: "Realizado",
          CANCELLED: "Cancelado",
          NO_SHOW: "No-show",
        };
        const data = grouped
          .map((g) => ({
            label: labelMap[g.status] ?? g.status,
            value: g._count._all,
          }))
          .filter((d) => d.value > 0);

        const payload: AstroChartPayload = {
          kind: "astro_chart",
          chartType: "pie",
          title: "Agendamentos por status",
          caption: `Período ${from.toLocaleDateString("pt-BR")} a ${to.toLocaleDateString("pt-BR")}`,
          data,
          valueFormat: "number",
        };
        return payload;
      },
    }),

    // ── LINE: crescimento mensal de leads (últimos 6 meses) ──────────────
    chart_leads_monthly_growth: tool({
      description:
        "Gráfico de LINHA — leads criados por mês nos últimos 6 meses. Use pra 'tendência de leads', 'crescimento mensal', 'evolução de leads'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        trackingIds: z.array(z.string()).optional(),
      }),
      execute: async ({ orgIds, trackingIds }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const trackings = await prisma.tracking.findMany({
          where: {
            organizationId: { in: targetOrgs },
            ...(trackingIds && trackingIds.length > 0
              ? { id: { in: trackingIds } }
              : {}),
          },
          select: { id: true },
        });
        const tIds = trackings.map((t) => t.id);

        const now = new Date();
        const monthsPt = [
          "Jan",
          "Fev",
          "Mar",
          "Abr",
          "Mai",
          "Jun",
          "Jul",
          "Ago",
          "Set",
          "Out",
          "Nov",
          "Dez",
        ];
        const data: { label: string; value: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const start = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1,
            0,
            0,
            0,
            0,
          );
          const end = new Date(
            now.getFullYear(),
            now.getMonth() - i + 1,
            1,
            0,
            0,
            0,
            0,
          );
          const count =
            tIds.length === 0
              ? 0
              : await prisma.lead.count({
                  where: {
                    trackingId: { in: tIds },
                    createdAt: { gte: start, lt: end },
                  },
                });
          data.push({ label: monthsPt[start.getMonth()]!, value: count });
        }

        const payload: AstroChartPayload = {
          kind: "astro_chart",
          chartType: "line",
          title: "Crescimento de leads",
          caption: "Últimos 6 meses",
          xLabel: "Mês",
          yLabel: "Leads criados",
          data,
          valueFormat: "number",
        };
        return payload;
      },
    }),

    // ── BAR: receita financeira recebida por mês ─────────────────────────
    chart_revenue_by_month: tool({
      description:
        "Gráfico de BARRAS — receita recebida (PaymentEntry tipo RECEIVABLE, status PAID) por mês nos últimos 6 meses. Use pra 'receita ao longo do tempo', 'evolução do faturamento'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
      }),
      execute: async ({ orgIds }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const now = new Date();
        const monthsPt = [
          "Jan",
          "Fev",
          "Mar",
          "Abr",
          "Mai",
          "Jun",
          "Jul",
          "Ago",
          "Set",
          "Out",
          "Nov",
          "Dez",
        ];
        const data: { label: string; value: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const start = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1,
            0,
            0,
            0,
            0,
          );
          const end = new Date(
            now.getFullYear(),
            now.getMonth() - i + 1,
            1,
            0,
            0,
            0,
            0,
          );
          const agg = await prisma.paymentEntry.aggregate({
            where: {
              organizationId: { in: targetOrgs },
              type: "RECEIVABLE",
              status: "PAID",
              paidAt: { gte: start, lt: end },
            },
            _sum: { paidAmount: true },
          });
          data.push({
            label: monthsPt[start.getMonth()]!,
            value: agg._sum.paidAmount ?? 0, // valor em centavos
          });
        }

        const payload: AstroChartPayload = {
          kind: "astro_chart",
          chartType: "bar",
          title: "Receita recebida",
          caption: "Últimos 6 meses",
          xLabel: "Mês",
          yLabel: "Receita (R$)",
          data,
          valueFormat: "currency",
        };
        return payload;
      },
    }),
  };
}
