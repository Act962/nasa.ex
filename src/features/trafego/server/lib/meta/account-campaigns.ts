import "server-only";

import { actId, fetchAdsInsightsDetailed, type InsightRow, type MetaInsightsFilter } from "@/http/meta/ads-management";
import { metaGraphPaginate } from "@/http/meta/graph-client";
import { buildAccountKpis, toCents, type AccountKpi } from "@/features/trafego/lib/order-meta-metrics";
import { deriveAdMetrics, type AdMetrics } from "@/features/trafego/lib/order-ads-metrics";
import { buildMetaReadCacheKey, readThroughMetaCache } from "./meta-read-cache";
import type { OrderMetaAccess } from "./order-meta-access";

/**
 * Todas as campanhas da conta de anúncios da org, criadas ou não pelo trafeGO.
 * Números do período (Insights) + estrutura (status, objetivo, orçamento), com o cache de 15 min.
 */

type AccountAccess = Extract<OrderMetaAccess, { mode: "account" }>;

/** Sem esse filtro a Insights API deixa de fora o gasto de campanhas arquivadas ou excluídas. */
const ALL_CAMPAIGN_STATUSES_FILTER: MetaInsightsFilter = {
  field: "campaign.effective_status",
  operator: "IN",
  value: ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED", "IN_PROCESS", "WITH_ISSUES"],
};

const STRUCTURE_PAGE_SIZE = 100;
const STRUCTURE_MAX_PAGES = 3;

type RawCampaign = {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
};

export interface AccountCampaign {
  id: string;
  name: string;
  objective: string | null;
  /** Status de entrega (effective_status); null quando só veio dos Insights (arquivada ou excluída). */
  status: string | null;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
  createdAt: string | null;
  metrics: AdMetrics;
}

export interface AccountCampaigns {
  kpis: AccountKpi[];
  series: { date: string; spendCents: number; conversations: number; impressions: number }[];
  campaigns: AccountCampaign[];
  isTruncated: boolean;
  fetchedAt: string;
}

function toBudgetCents(value: string | undefined): number | null {
  const budget = Number(value);
  return Number.isFinite(budget) && budget > 0 ? budget : null;
}

function toMetrics(row: InsightRow | undefined): AdMetrics {
  return deriveAdMetrics({
    spendCents: toCents(row?.spend ?? 0),
    impressions: row?.impressions ?? 0,
    reach: row?.reach ?? 0,
    clicks: row?.clicks ?? 0,
    conversations: row?.messagingConversations ?? 0,
  });
}

export async function getAccountCampaigns(
  access: AccountAccess,
  period: { since: string; until: string },
): Promise<AccountCampaigns> {
  return readThroughMetaCache(
    buildMetaReadCacheKey({
      block: "account-campaigns-v1",
      org: access.organizationId,
      act: access.auth.adAccountId,
      since: period.since,
      until: period.until,
    }),
    async () => {
      const [totals, daily, campaignInsights, structure] = await Promise.all([
        fetchAdsInsightsDetailed(access.auth, { level: "account", timeRange: period, unifiedAttribution: true }),
        fetchAdsInsightsDetailed(access.auth, {
          level: "account",
          timeRange: period,
          timeIncrement: 1,
          unifiedAttribution: true,
        }),
        fetchAdsInsightsDetailed(access.auth, {
          level: "campaign",
          timeRange: period,
          unifiedAttribution: true,
          filtering: [ALL_CAMPAIGN_STATUSES_FILTER],
          maxPages: 5,
        }),
        // Arquivadas e excluídas ficam de fora da estrutura: aparecem só se gastaram no período.
        metaGraphPaginate<RawCampaign>(`${actId(access.auth.adAccountId)}/campaigns`, {
          auth: access.auth,
          maxPages: STRUCTURE_MAX_PAGES,
          query: {
            fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,created_time",
            limit: STRUCTURE_PAGE_SIZE,
            filtering: JSON.stringify([
              { field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES"] },
            ]),
          },
        }),
      ]);

      const insightByCampaignId = new Map(
        campaignInsights.rows
          .filter((row): row is InsightRow & { campaignId: string } => Boolean(row.campaignId))
          .map((row) => [row.campaignId, row]),
      );
      const campaigns: AccountCampaign[] = structure.items.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective ?? null,
        status: campaign.effective_status ?? campaign.status ?? null,
        dailyBudgetCents: toBudgetCents(campaign.daily_budget),
        lifetimeBudgetCents: toBudgetCents(campaign.lifetime_budget),
        createdAt: campaign.created_time ?? null,
        metrics: toMetrics(insightByCampaignId.get(campaign.id)),
      }));
      const listedIds = new Set(campaigns.map((campaign) => campaign.id));
      for (const [campaignId, row] of insightByCampaignId) {
        if (listedIds.has(campaignId)) continue;
        campaigns.push({
          id: campaignId,
          name: row.campaignName ?? campaignId,
          objective: null,
          status: null,
          dailyBudgetCents: null,
          lifetimeBudgetCents: null,
          createdAt: null,
          metrics: toMetrics(row),
        });
      }
      campaigns.sort(
        (first, second) =>
          second.metrics.spendCents - first.metrics.spendCents ||
          Number(second.status === "ACTIVE") - Number(first.status === "ACTIVE") ||
          (second.createdAt ?? "").localeCompare(first.createdAt ?? ""),
      );

      const accountTotals = totals.rows[0];
      return {
        kpis: buildAccountKpis({
          spend: accountTotals?.spend ?? 0,
          messagingConversations: accountTotals?.messagingConversations ?? 0,
          costPerMessagingConversation: accountTotals?.costPerMessagingConversation ?? 0,
          reach: accountTotals?.reach ?? 0,
          impressions: accountTotals?.impressions ?? 0,
          clicks: accountTotals?.clicks ?? 0,
          ctr: accountTotals?.ctr ?? 0,
          cpm: accountTotals?.cpm ?? 0,
          frequency: accountTotals?.frequency ?? 0,
        }),
        series: daily.rows
          .filter((row) => row.dateStart)
          .map((row) => ({
            date: row.dateStart as string,
            spendCents: toCents(row.spend),
            conversations: row.messagingConversations,
            impressions: row.impressions,
          }))
          .sort((first, second) => first.date.localeCompare(second.date)),
        campaigns,
        isTruncated: campaignInsights.truncated || structure.truncated || daily.truncated,
        fetchedAt: new Date().toISOString(),
      };
    },
  );
}
