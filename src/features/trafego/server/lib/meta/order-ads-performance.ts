import "server-only";

import { fetchAdsInsightsDetailed, type InsightRow, type MetaInsightsFilter } from "@/http/meta/ads-management";
import { findMetaCampaignTreesByName, getMetaCampaignTree, type MetaCampaignTree } from "@/http/meta/ads-builder";
import { isOrderCampaign, toCents } from "@/features/trafego/lib/order-meta-metrics";
import {
  averageAdMetrics,
  deriveAdMetrics,
  sumAdMetrics,
  type AdMetrics,
  type AdMetricsInput,
} from "@/features/trafego/lib/order-ads-metrics";
import { buildMetaReadCacheKey, readThroughMetaCache } from "./meta-read-cache";
import type { OrderMetaAccess } from "./order-meta-access";
import { computeAdsetQuality, evaluateAdQuality, type AdRankings, type MetaRanking, type QualityResult } from "@/features/trafego/lib/quality-score";
import { loadAdLeadOrigins, type AdLeadOrigin } from "./ad-lead-origin";

/** Visão da campanha por anúncio (spec 0126, RF-2): prévia + números do período, com o cache de 15 min. */

type AccountAccess = Extract<OrderMetaAccess, { mode: "account" }>;

interface OrderForAds {
  code: string;
  metaCampaignExternalId: string | null;
}

export interface OrderAdPerformance {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  /** Conjunto de anúncios do anúncio, mostrado no cartão da lista. */
  adsetId: string;
  adsetName: string | null;
  /** Status configurado do conjunto (ACTIVE/PAUSED), para o botão liga/desliga. */
  adsetStatus: string | null;
  /** Status de entrega (effective_status): pode ser pausado pelo conjunto ou pela campanha. */
  status: string | null;
  /** Status configurado do anúncio, para o botão liga/desliga. */
  configuredStatus: string | null;
  /** Média de comparação das setas e da nota: mesmo objetivo ou, sem anúncios suficientes, a conta (RF-13). */
  benchmark: AdMetrics | null;
  benchmarkScope: "objective" | "account";
  quality: QualityResult;
  rankings: AdRankings;
  /** Texto pronto do anúncio de WhatsApp (RF-16). */
  initialMessage: string | null;
  /** Leads que chegaram no Órbita por este anúncio (RF-16). */
  leadOrigin: AdLeadOrigin | null;
  /** Data a partir da qual dá para mexer sem atrapalhar o aprendizado (RF-11). */
  evaluateFrom: string | null;
  previewUrl: string | null;
  previewLink: string | null;
  metrics: AdMetrics;
}

export interface OrderAdsPerformance {
  totals: AdMetrics;
  /** Média por anúncio da conta de anúncios inteira no período: base das setas acima/abaixo da média. */
  averages: AdMetrics | null;
  /** Campanhas do pedido na conta (com ou sem anúncio no ar). */
  campaignsCount: number;
  adsets: { id: string; name: string; status: string | null; quality: QualityResult | null }[];
  ads: OrderAdPerformance[];
  isTruncated: boolean;
  fetchedAt: string;
}

const ALL_AD_STATUSES_FILTER: MetaInsightsFilter = {
  field: "campaign.effective_status",
  operator: "IN",
  value: ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED", "IN_PROCESS", "WITH_ISSUES"],
};

const EMPTY_METRICS_INPUT: AdMetricsInput = { spendCents: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0 };

function toMetricsByAdId(rows: InsightRow[]): Map<string, AdMetricsInput> {
  return new Map(
    rows
      .filter((row) => row.adId)
      .map((row) => [
        row.adId as string,
        {
          spendCents: toCents(row.spend),
          impressions: row.impressions,
          reach: row.reach,
          clicks: row.clicks,
          conversations: row.messagingConversations,
        },
      ]),
  );
}

/** Mínimo de anúncios do mesmo objetivo para comparar só com eles (spec 0128, RF-13). */
const MIN_ADS_FOR_OBJECTIVE_BENCHMARK = 3;

interface AccountBenchmarks {
  overall: AdMetrics | null;
  byObjective: Record<string, { metrics: AdMetrics; adsCount: number }>;
}

/**
 * Média por anúncio da conta no período (só anúncios que gastaram), no total e por objetivo:
 * campanha de conversa não se compara com campanha de alcance (D-6). Cache próprio, vale para todos os pedidos.
 */
async function readAccountBenchmarks(
  access: AccountAccess,
  period: { since: string; until: string },
): Promise<AccountBenchmarks> {
  return readThroughMetaCache(
    buildMetaReadCacheKey({
      block: "account-ad-benchmarks",
      org: access.organizationId,
      act: access.auth.adAccountId,
      since: period.since,
      until: period.until,
    }),
    async () => {
      const { rows } = await fetchAdsInsightsDetailed(access.auth, {
        level: "ad",
        timeRange: period,
        unifiedAttribution: true,
        filtering: [ALL_AD_STATUSES_FILTER],
        maxPages: 5,
        extraFields: ["objective"],
      });
      const delivered = rows.filter((row) => row.adId && toCents(row.spend) > 0);
      const metricsByAdId = toMetricsByAdId(delivered);
      const adsByObjective = new Map<string, AdMetricsInput[]>();
      for (const row of delivered) {
        const metrics = metricsByAdId.get(row.adId as string);
        if (!metrics || !row.objective) continue;
        adsByObjective.set(row.objective, [...(adsByObjective.get(row.objective) ?? []), metrics]);
      }
      const byObjective: AccountBenchmarks["byObjective"] = {};
      for (const [objective, items] of adsByObjective) {
        const metrics = averageAdMetrics(items);
        if (metrics) byObjective[objective] = { metrics, adsCount: items.length };
      }
      return { overall: averageAdMetrics([...metricsByAdId.values()]), byObjective };
    },
  );
}

function pickBenchmark(benchmarks: AccountBenchmarks, objective: string | undefined) {
  const sameObjective = objective ? benchmarks.byObjective[objective] : undefined;
  if (sameObjective && sameObjective.adsCount >= MIN_ADS_FOR_OBJECTIVE_BENCHMARK) {
    return { metrics: sameObjective.metrics, scope: "objective" as const };
  }
  return { metrics: benchmarks.overall, scope: "account" as const };
}

function toRanking(value: string | undefined): MetaRanking | null {
  return value ? (value as MetaRanking) : null;
}

async function loadOrderCampaignTrees(access: AccountAccess, order: OrderForAds): Promise<MetaCampaignTree[]> {
  const trees = await findMetaCampaignTreesByName(access.auth, access.auth.adAccountId, order.code);
  const orderTrees = trees.filter((tree) =>
    isOrderCampaign({
      campaignId: tree.id,
      campaignName: tree.name,
      orderCode: order.code,
      linkedCampaignId: order.metaCampaignExternalId,
    }),
  );
  const isLinkedMissing =
    Boolean(order.metaCampaignExternalId) && !orderTrees.some((tree) => tree.id === order.metaCampaignExternalId);
  if (isLinkedMissing && order.metaCampaignExternalId) {
    const linked = await getMetaCampaignTree(access.auth, order.metaCampaignExternalId).catch(() => null);
    if (linked) orderTrees.push(linked);
  }
  return orderTrees;
}

export async function getOrderAdsPerformance(
  access: AccountAccess,
  order: OrderForAds,
  period: { since: string; until: string },
): Promise<OrderAdsPerformance> {
  return readThroughMetaCache(
    buildMetaReadCacheKey({
      block: "ads-v5",
      org: access.organizationId,
      act: access.auth.adAccountId,
      code: order.code,
      linked: order.metaCampaignExternalId,
      since: period.since,
      until: period.until,
    }),
    async () => {
      const trees = await loadOrderCampaignTrees(access, order);
      const campaignIds = trees.map((tree) => tree.id);
      if (campaignIds.length === 0) {
        return {
          totals: sumAdMetrics([]),
          averages: null,
          campaignsCount: 0,
          adsets: [],
          ads: [],
          isTruncated: false,
          fetchedAt: new Date().toISOString(),
        };
      }

      const filtering: MetaInsightsFilter[] = [
        { field: "campaign.id", operator: "IN", value: campaignIds },
        ALL_AD_STATUSES_FILTER,
      ];
      const [current, benchmarks] = await Promise.all([
        fetchAdsInsightsDetailed(access.auth, {
          level: "ad",
          timeRange: period,
          unifiedAttribution: true,
          filtering,
          extraFields: ["objective", "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking"],
        }),
        readAccountBenchmarks(access, period),
      ]);
      const metricsByAdId = toMetricsByAdId(current.rows);
      const rowByAdId = new Map(current.rows.filter((row) => row.adId).map((row) => [row.adId as string, row]));
      const leadOrigins = await loadAdLeadOrigins(
        access.organizationId,
        trees.flatMap((tree) => tree.ads.map((ad) => ad.id)),
      ).catch(() => new Map<string, AdLeadOrigin>());

      const ads = trees.flatMap((tree) =>
        tree.ads.map((ad) => {
          const adset = tree.adsets.find((item) => item.id === ad.adsetId);
          const row = rowByAdId.get(ad.id);
          const metrics = deriveAdMetrics(metricsByAdId.get(ad.id) ?? EMPTY_METRICS_INPUT);
          const benchmark = pickBenchmark(benchmarks, row?.objective);
          const rankings: AdRankings = {
            quality: toRanking(row?.qualityRanking),
            engagement: toRanking(row?.engagementRanking),
            conversion: toRanking(row?.conversionRanking),
          };
          const quality = evaluateAdQuality({
            metrics,
            benchmark: benchmark.metrics,
            rankings,
            deliveryStatus: ad.effectiveStatus,
            adCreatedAt: ad.createdAt,
            adsetLearningStatus: adset?.learningStatus ?? null,
            adsetChangedAt: adset?.changedAt ?? null,
          });
          return {
          id: ad.id,
          name: ad.name,
          campaignId: tree.id,
          campaignName: tree.name,
          adsetId: ad.adsetId,
          adsetName: adset?.name ?? null,
          adsetStatus: adset?.status ?? null,
          configuredStatus: ad.status,
          status: ad.effectiveStatus ?? ad.status,
          previewUrl: ad.previewUrl,
          previewLink: ad.previewLink,
          metrics,
          benchmark: benchmark.metrics,
          benchmarkScope: benchmark.scope,
          quality,
          rankings,
          initialMessage: ad.creative?.initialMessage ?? null,
          leadOrigin: leadOrigins.get(ad.id) ?? null,
          evaluateFrom: quality.status === "learning" || quality.status === "insufficient" ? quality.evaluateFrom : null,
          };
        }),
      );
      ads.sort((first, second) => second.metrics.spendCents - first.metrics.spendCents);

      return {
        totals: sumAdMetrics(ads.map((ad) => ad.metrics)),
        averages: benchmarks.overall,
        campaignsCount: trees.length,
        adsets: trees.flatMap((tree) =>
          tree.adsets.map((adset) => ({
            id: adset.id,
            name: adset.name,
            status: adset.status,
            quality: computeAdsetQuality(
              ads
                .filter((ad) => ad.adsetId === adset.id)
                .map((ad) => ({ result: ad.quality, spendCents: ad.metrics.spendCents })),
            ),
          })),
        ),
        ads,
        isTruncated: current.truncated,
        fetchedAt: new Date().toISOString(),
      };
    },
  );
}
