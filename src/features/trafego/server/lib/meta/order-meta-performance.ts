import "server-only";

import {
  fetchAdsBreakdowns,
  fetchAdsInsightsDetailed,
  listMetaCampaigns,
  type InsightRow,
  type MetaInsightsFilter,
} from "@/http/meta/ads-management";
import {
  buildAccountKpis,
  buildOrderBudgetUsage,
  isOrderCampaign,
  toCents,
  type AccountKpi,
  type OrderBudgetUsage,
  type PerformanceBreakdown,
} from "@/features/trafego/lib/order-meta-metrics";
import { buildMetaReadCacheKey, readThroughMetaCache } from "./meta-read-cache";
import type { OrderMetaAccess } from "./order-meta-access";

/** Leituras do Desempenho pela conta do cliente (spec 0122, RF-12..RF-14). Só leitura, com cache de 15 min. */

type AccountAccess = Extract<OrderMetaAccess, { mode: "account" }>;

interface OrderForMetrics {
  code: string;
  adBudgetBrlCents: number;
  metaCampaignExternalId: string | null;
}

/** Sem esse filtro a Insights API deixa de fora o gasto de campanhas arquivadas ou excluídas. */
const ALL_CAMPAIGN_STATUSES_FILTER: MetaInsightsFilter = {
  field: "campaign.effective_status",
  operator: "IN",
  value: ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED", "IN_PROCESS", "WITH_ISSUES"],
};

function cacheKey(access: AccountAccess, parts: Record<string, string | number | null | undefined>) {
  return buildMetaReadCacheKey({ ...parts, org: access.organizationId, act: access.auth.adAccountId });
}

function sumSpend(rows: InsightRow[]): number {
  return rows.reduce((total, row) => total + row.spend, 0);
}

/** Verba usada: gasto lifetime das campanhas do pedido, inclusive arquivadas (RF-13, CA-2). */
export async function getOrderBudgetUsage(access: AccountAccess, order: OrderForMetrics): Promise<OrderBudgetUsage> {
  const spendCents = await readThroughMetaCache(
    cacheKey(access, { block: "budget", code: order.code, linked: order.metaCampaignExternalId }),
    async () => {
      const { rows: rowsByName } = await fetchAdsInsightsDetailed(access.auth, {
        level: "campaign",
        datePreset: "maximum",
        unifiedAttribution: true,
        filtering: [
          { field: "campaign.name", operator: "CONTAIN", value: order.code },
          ALL_CAMPAIGN_STATUSES_FILTER,
        ],
      });
      const orderRows = rowsByName.filter((row) =>
        isOrderCampaign({
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          orderCode: order.code,
          linkedCampaignId: order.metaCampaignExternalId,
        }),
      );

      const isLinkedCampaignMissing =
        Boolean(order.metaCampaignExternalId) &&
        !orderRows.some((row) => row.campaignId === order.metaCampaignExternalId);
      if (isLinkedCampaignMissing && order.metaCampaignExternalId) {
        const { rows: linkedRows } = await fetchAdsInsightsDetailed(access.auth, {
          level: "campaign",
          datePreset: "maximum",
          unifiedAttribution: true,
          filtering: [
            { field: "campaign.id", operator: "EQUAL", value: order.metaCampaignExternalId },
            ALL_CAMPAIGN_STATUSES_FILTER,
          ],
        });
        orderRows.push(...linkedRows);
      }
      return toCents(sumSpend(orderRows));
    },
  );

  return buildOrderBudgetUsage({
    adBudgetBrlCents: order.adBudgetBrlCents,
    spentCents: spendCents,
    currency: access.account.currency,
  });
}

export interface AccountCampaignSummary {
  id: string;
  name: string;
  status: string | null;
  spendCents: number;
  conversations: number;
  impressions: number;
  clicks: number;
  isOrderCampaign: boolean;
}

export interface AccountOverview {
  kpis: AccountKpi[];
  series: { date: string; spendCents: number; conversations: number; impressions: number }[];
  campaigns: AccountCampaignSummary[];
  isTruncated: boolean;
  fetchedAt: string;
}

export async function getAccountOverview(
  access: AccountAccess,
  order: OrderForMetrics,
  period: { since: string; until: string },
): Promise<AccountOverview> {
  return readThroughMetaCache(
    cacheKey(access, {
      block: "overview",
      since: period.since,
      until: period.until,
      code: order.code,
      linked: order.metaCampaignExternalId,
    }),
    async () => {
      const [totals, daily, campaignInsights, campaignList] = await Promise.all([
        fetchAdsInsightsDetailed(access.auth, { level: "account", timeRange: period, unifiedAttribution: true }),
        fetchAdsInsightsDetailed(access.auth, {
          level: "account",
          timeRange: period,
          timeIncrement: 1,
          unifiedAttribution: true,
        }),
        fetchAdsInsightsDetailed(access.auth, { level: "campaign", timeRange: period, unifiedAttribution: true }),
        listMetaCampaigns(access.auth),
      ]);

      const accountTotals = totals.rows[0];
      const statusByCampaignId = new Map(campaignList.map((campaign) => [campaign.id, campaign.effective_status ?? null]));

      const campaigns = campaignInsights.rows
        .filter((row): row is InsightRow & { campaignId: string } => Boolean(row.campaignId))
        .map((row) => ({
          id: row.campaignId,
          name: row.campaignName ?? row.campaignId,
          status: statusByCampaignId.get(row.campaignId) ?? null,
          spendCents: toCents(row.spend),
          conversations: row.messagingConversations,
          impressions: row.impressions,
          clicks: row.clicks,
          isOrderCampaign: isOrderCampaign({
            campaignId: row.campaignId,
            campaignName: row.campaignName,
            orderCode: order.code,
            linkedCampaignId: order.metaCampaignExternalId,
          }),
        }))
        .sort((first, second) =>
          first.isOrderCampaign === second.isOrderCampaign
            ? second.spendCents - first.spendCents
            : first.isOrderCampaign
              ? -1
              : 1,
        );

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
        isTruncated: campaignInsights.truncated || daily.truncated,
        fetchedAt: new Date().toISOString(),
      };
    },
  );
}

export async function getAccountBreakdown(
  access: AccountAccess,
  period: { since: string; until: string },
  breakdown: PerformanceBreakdown,
) {
  return readThroughMetaCache(
    cacheKey(access, { block: "breakdown", breakdown, since: period.since, until: period.until }),
    async () => {
      const rows = await fetchAdsBreakdowns(access.auth, { breakdown, timeRange: period, unifiedAttribution: true });
      return rows
        .map((row) => ({
          segment: row.segment,
          spendCents: toCents(row.spend),
          reach: row.reach,
          impressions: row.impressions,
          clicks: row.clicks,
        }))
        .sort((first, second) => second.spendCents - first.spendCents);
    },
  );
}

export interface AccountCampaignSpend {
  campaignId: string | null;
  campaignName: string | null;
  spendBrlCents: number;
}

/** Gasto por campanha da conta toda no período, inclusive arquivadas: base do complemento (spec 0123, RF-11). */
export async function getAccountSpendByCampaign(
  access: AccountAccess,
  period: { since: string; until: string },
): Promise<{ campaigns: AccountCampaignSpend[]; isTruncated: boolean }> {
  return readThroughMetaCache(
    cacheKey(access, { block: "spend-by-campaign", since: period.since, until: period.until }),
    async () => {
      const { rows, truncated } = await fetchAdsInsightsDetailed(access.auth, {
        level: "campaign",
        timeRange: period,
        unifiedAttribution: true,
        filtering: [ALL_CAMPAIGN_STATUSES_FILTER],
        maxPages: 10,
      });
      return {
        campaigns: rows.map((row) => ({
          campaignId: row.campaignId ?? null,
          campaignName: row.campaignName ?? null,
          spendBrlCents: toCents(row.spend),
        })),
        isTruncated: truncated,
      };
    },
  );
}
