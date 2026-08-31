import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

/**
 * Desempenho da campanha, com contrato único para as duas plataformas — o
 * componente não precisa saber de onde o número veio.
 *
 * Meta: os KPIs vivem em `MetaAdsKpiSnapshot`, chaveados pela org que detém a
 * `PlatformIntegration(META)` — a da AGÊNCIA, não a do cliente. Por isso a
 * leitura usa `order.metricsOrganizationId`, e não a org da sessão. A checagem
 * de posse do pedido acontece ANTES disso: sem ela, esse campo viraria um
 * vazamento cross-org (spec 0008 RNF-4).
 */
export const getTrafegoOrderPerformance = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      days: z.number().int().min(1).max(180).default(30),
    }),
  )
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findFirst({
      where: { id: input.orderId, organizationId: context.org.id },
      select: {
        id: true,
        status: true,
        platform: true,
        adBudgetBrlCents: true,
        metaCampaignExternalId: true,
        metricsOrganizationId: true,
        broadcastId: true,
        startedAt: true,
      },
    });

    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
    }

    const to = new Date();
    const from = new Date(to.getTime() - input.days * 24 * 60 * 60 * 1000);
    const period = { from, to };
    const emptyBudget = {
      adBudgetBrlCents: order.adBudgetBrlCents,
      spentBrlCents: 0,
      remainingBrlCents: order.adBudgetBrlCents,
      percentUsed: 0,
    };

    if (order.platform === "META_ADS") {
      if (!order.metaCampaignExternalId || !order.metricsOrganizationId) {
        return {
          platform: order.platform,
          status: order.status,
          hasMetrics: false as const,
          reason: "not_linked" as const,
          period,
          kpis: [],
          series: [],
          budget: emptyBudget,
        };
      }

      const snapshots = await prisma.metaAdsKpiSnapshot.findMany({
        where: {
          organizationId: order.metricsOrganizationId,
          level: "CAMPAIGN",
          entityId: order.metaCampaignExternalId,
          date: { gte: from, lte: to },
        },
        orderBy: { date: "asc" },
      });

      if (snapshots.length === 0) {
        return {
          platform: order.platform,
          status: order.status,
          hasMetrics: false as const,
          reason: "no_data_yet" as const,
          period,
          kpis: [],
          series: [],
          budget: emptyBudget,
        };
      }

      const sum = (pick: (row: (typeof snapshots)[number]) => number) =>
        snapshots.reduce((total, row) => total + pick(row), 0);

      const impressions = sum((row) => row.impressions);
      const reach = sum((row) => row.reach);
      const clicks = sum((row) => row.clicks);
      const leads = sum((row) => row.leads);
      const conversions = sum((row) => row.conversions);
      const spend = sum((row) => Number(row.spend));
      const spentBrlCents = Math.round(spend * 100);

      return {
        platform: order.platform,
        status: order.status,
        hasMetrics: true as const,
        period,
        kpis: [
          { key: "impressions", label: "Impressões", value: impressions, format: "int" as const },
          { key: "reach", label: "Pessoas alcançadas", value: reach, format: "int" as const },
          { key: "clicks", label: "Cliques", value: clicks, format: "int" as const },
          {
            key: "ctr",
            label: "Taxa de cliques",
            value: impressions > 0 ? (clicks / impressions) * 100 : 0,
            format: "pct" as const,
          },
          { key: "leads", label: "Leads", value: leads, format: "int" as const },
          { key: "conversions", label: "Conversões", value: conversions, format: "int" as const },
          { key: "spend", label: "Investido", value: spentBrlCents, format: "currency" as const },
          {
            key: "cpc",
            label: "Custo por clique",
            value: clicks > 0 ? Math.round(spentBrlCents / clicks) : 0,
            format: "currency" as const,
          },
        ],
        series: snapshots.map((row) => ({
          date: row.date,
          primary: row.impressions,
          secondary: row.clicks,
        })),
        budget: {
          adBudgetBrlCents: order.adBudgetBrlCents,
          spentBrlCents,
          remainingBrlCents: Math.max(0, order.adBudgetBrlCents - spentBrlCents),
          percentUsed:
            order.adBudgetBrlCents > 0
              ? Math.min(100, (spentBrlCents / order.adBudgetBrlCents) * 100)
              : 0,
        },
      };
    }

    // ── WhatsApp Oficial: contadores denormalizados do Broadcast ────────────
    if (!order.broadcastId) {
      return {
        platform: order.platform,
        status: order.status,
        hasMetrics: false as const,
        reason: "not_linked" as const,
        period,
        kpis: [],
        series: [],
        budget: emptyBudget,
      };
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: order.broadcastId },
      select: {
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!broadcast || broadcast.totalRecipients === 0) {
      return {
        platform: order.platform,
        status: order.status,
        hasMetrics: false as const,
        reason: "no_data_yet" as const,
        period,
        kpis: [],
        series: [],
        budget: emptyBudget,
      };
    }

    const rate = (part: number) =>
      broadcast.sentCount > 0 ? (part / broadcast.sentCount) * 100 : 0;

    return {
      platform: order.platform,
      status: order.status,
      hasMetrics: true as const,
      period,
      kpis: [
        { key: "recipients", label: "Destinatários", value: broadcast.totalRecipients, format: "int" as const },
        { key: "sent", label: "Enviadas", value: broadcast.sentCount, format: "int" as const },
        { key: "delivered", label: "Entregues", value: broadcast.deliveredCount, format: "int" as const },
        { key: "read", label: "Lidas", value: broadcast.readCount, format: "int" as const },
        { key: "deliveryRate", label: "Taxa de entrega", value: rate(broadcast.deliveredCount), format: "pct" as const },
        { key: "readRate", label: "Taxa de leitura", value: rate(broadcast.readCount), format: "pct" as const },
        { key: "failed", label: "Falhas", value: broadcast.failedCount, format: "int" as const },
      ],
      series: [],
      budget: emptyBudget,
    };
  });
