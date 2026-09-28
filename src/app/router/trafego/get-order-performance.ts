import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { getLiveCampaignKpis } from "@/features/trafego/server/lib/live-meta-insights";

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
        metaAutoLinkedAt: true,
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
          source: "snapshot" as const,
          autoLinked: Boolean(order.metaAutoLinkedAt),
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

      // O cron de KPIs roda 3h da manhã com o dado de ONTEM. Campanha que
      // acabou de subir ficaria até 24h mostrando "sem dados" — justo quando
      // o cliente mais olha. Busca ao vivo antes de desistir.
      if (snapshots.length === 0) {
        const live = await getLiveCampaignKpis({
          orderId: order.id,
          metricsOrganizationId: order.metricsOrganizationId,
          metaCampaignExternalId: order.metaCampaignExternalId,
          since: order.startedAt ?? from,
          until: to,
        });

        if (!live) {
          return {
            platform: order.platform,
            status: order.status,
            hasMetrics: false as const,
            reason: "no_data_yet" as const,
            source: "snapshot" as const,
            autoLinked: Boolean(order.metaAutoLinkedAt),
            period,
            kpis: [],
            series: [],
            budget: emptyBudget,
          };
        }

        const liveSpentBrlCents = Math.round(live.spend * 100);
        return {
          platform: order.platform,
          status: order.status,
          hasMetrics: true as const,
          source: "live" as const,
          updatedAt: live.fetchedAt,
          autoLinked: Boolean(order.metaAutoLinkedAt),
          period,
          kpis: buildMetaKpis({
            impressions: live.impressions,
            reach: live.reach,
            clicks: live.clicks,
            leads: live.leads,
            conversions: live.conversions,
            spentBrlCents: liveSpentBrlCents,
          }),
          // A leitura ao vivo vem agregada, sem quebra por dia: o gráfico
          // aparece quando o primeiro snapshot chegar.
          series: [],
          budget: buildBudget(order.adBudgetBrlCents, liveSpentBrlCents),
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
        source: "snapshot" as const,
        updatedAt: snapshots.at(-1)?.syncedAt ?? null,
        autoLinked: Boolean(order.metaAutoLinkedAt),
        period,
        kpis: buildMetaKpis({
          impressions,
          reach,
          clicks,
          leads,
          conversions,
          spentBrlCents,
        }),
        series: snapshots.map((row) => ({
          date: row.date,
          primary: row.impressions,
          secondary: row.clicks,
        })),
        budget: buildBudget(order.adBudgetBrlCents, spentBrlCents),
      };
    }

    // ── WhatsApp Oficial: contadores denormalizados do Broadcast ────────────
    if (!order.broadcastId) {
      return {
        platform: order.platform,
        status: order.status,
        hasMetrics: false as const,
        reason: "not_linked" as const,
        source: "snapshot" as const,
        autoLinked: Boolean(order.metaAutoLinkedAt),
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
        source: "snapshot" as const,
        autoLinked: Boolean(order.metaAutoLinkedAt),
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
      source: "snapshot" as const,
      autoLinked: Boolean(order.metaAutoLinkedAt),
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

/** Mesma lista de KPIs para o dado do snapshot e para o dado ao vivo. */
function buildMetaKpis(totals: {
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  conversions: number;
  spentBrlCents: number;
}) {
  return [
    { key: "impressions", label: "Impressões", value: totals.impressions, format: "int" as const },
    { key: "reach", label: "Pessoas alcançadas", value: totals.reach, format: "int" as const },
    { key: "clicks", label: "Cliques", value: totals.clicks, format: "int" as const },
    {
      key: "ctr",
      label: "Taxa de cliques",
      value: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      format: "pct" as const,
    },
    { key: "leads", label: "Leads", value: totals.leads, format: "int" as const },
    { key: "conversions", label: "Conversões", value: totals.conversions, format: "int" as const },
    { key: "spend", label: "Investido", value: totals.spentBrlCents, format: "currency" as const },
    {
      key: "cpc",
      label: "Custo por clique",
      value: totals.clicks > 0 ? Math.round(totals.spentBrlCents / totals.clicks) : 0,
      format: "currency" as const,
    },
  ];
}

function buildBudget(adBudgetBrlCents: number, spentBrlCents: number) {
  return {
    adBudgetBrlCents,
    spentBrlCents,
    remainingBrlCents: Math.max(0, adBudgetBrlCents - spentBrlCents),
    percentUsed:
      adBudgetBrlCents > 0 ? Math.min(100, (spentBrlCents / adBudgetBrlCents) * 100) : 0,
  };
}
