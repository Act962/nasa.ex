import { orpc } from "@/lib/orpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AccountPeriodSelection, PerformanceBreakdown } from "@/features/trafego/lib/order-meta-metrics";

/** Conta de anúncios inteira no painel. O servidor guarda 15 min; o painel relê no mesmo ritmo. */

const REFETCH_INTERVAL_MS = 15 * 60 * 1000;

function toPeriodInput(period: AccountPeriodSelection) {
  return period.range === "custom"
    ? { range: period.range, since: period.since, until: period.until }
    : { range: period.range };
}

export const useTrafegoAccountCampaigns = (period: AccountPeriodSelection) => {
  return useQuery({
    ...orpc.trafego.account.campaigns.queryOptions({ input: toPeriodInput(period) }),
    // Trocar o período mantém a tela (e o seletor) no lugar enquanto o novo chega.
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
};

export const useTrafegoAccountCampaignAds = (
  campaignId: string,
  period: AccountPeriodSelection,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.account.campaignAds.queryOptions({ input: { ...toPeriodInput(period), campaignId } }),
    enabled: (options?.enabled ?? true) && Boolean(campaignId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
};

export const useTrafegoAccountWideBreakdown = (
  period: AccountPeriodSelection,
  breakdown: PerformanceBreakdown,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.account.breakdown.queryOptions({ input: { ...toPeriodInput(period), breakdown } }),
    enabled: options?.enabled ?? true,
  });
};
