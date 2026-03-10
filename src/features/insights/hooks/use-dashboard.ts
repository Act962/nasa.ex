"use client";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { DashboardReport, DateRange } from "@/features/insights/types";
import { mockDashboardData } from "@/features/insights/types/mock";

interface InsightFilter {
  trackingId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Hook to get the consolidated tracking dashboard report.
 */
export const useQueryTrackingDashboardReport = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getTrackingDashboardReport.queryOptions({ input }),
  );

  return {
    report: data,
    ...query,
  };
};

/**
 * Hook to get lead count grouped by acquisition channel.
 */
export const useQueryLeadsByAcquisitionChannel = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getLeadsByAcquisitionChannel.queryOptions({ input }),
  );

  return {
    channels: data?.channels ?? [],
    total: data?.total ?? 0,
    ...query,
  };
};

/**
 * Hook to get lead count for a tracking, grouped by status and action.
 */
export const useQueryLeadCountByTracking = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getLeadCountByTracking.queryOptions({ input }),
  );

  return {
    stats: data,
    ...query,
  };
};

/**
 * Hook to get lead distribution grouped by responsible user.
 */
export const useQueryLeadsByAttendant = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getLeadsByAttendant.queryOptions({ input }),
  );

  return {
    attendants: data?.attendants ?? [],
    unassignedCount: data?.unassignedCount ?? 0,
    ...query,
  };
};

/**
 * Hook to get lead count grouped by tags.
 */
export const useQueryLeadsByTags = (
  input: InsightFilter & { tagIds?: string[] },
) => {
  const { data, ...query } = useQuery(
    orpc.insights.getLeadsByTags.queryOptions({ input }),
  );

  return {
    tags: data?.tags ?? [],
    totalWithTags: data?.totalWithTags ?? 0,
    ...query,
  };
};

/**
 * Hook to get leads won this month vs last month.
 */
export const useQuerySoldThisMonth = (input: {
  trackingId?: string;
  referenceMonth?: string;
}) => {
  const { data, ...query } = useQuery(
    orpc.insights.getSoldThisMonth.queryOptions({ input }),
  );

  return {
    soldData: data,
    ...query,
  };
};

/**
 * Hook to get won leads count and details.
 */
export const useQueryWonLeads = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getWonLeads.queryOptions({ input }),
  );

  return {
    wonData: data,
    ...query,
  };
};

interface UseDashboardDataOptions {
  trackingId?: string;
  dateRange: DateRange;
}

/**
 * Hook to list all trackings for the current organization.
 */
export const useQueryListTrackings = () => {
  const { data, ...query } = useQuery(orpc.tracking.list.queryOptions({}));

  return {
    trackings: data ?? [],
    ...query,
  };
};

export function useDashboardData({
  trackingId,
  dateRange,
}: UseDashboardDataOptions) {
  const startDate = dateRange.from?.toISOString();
  const endDate = dateRange.to?.toISOString();

  const { report, isLoading, isRefetching, refetch } =
    useQueryTrackingDashboardReport({
      trackingId,
      startDate,
      endDate,
    });

  return {
    data: report ?? mockDashboardData,
    error: null,
    isLoading,
    isValidating: isRefetching,
    refresh: () => refetch(),
  };
}

// Hook para usar com filtros do store
export function useDashboardDataWithStore() {
  // Importe e use o store aqui se precisar
  // const { trackingId, dateRange } = useDashboardFilters()
  // return useDashboardData({ trackingId, dateRange })

  // Por agora, retornamos dados mock
  return useDashboardData({
    trackingId: "tracking-1",
    dateRange: { from: undefined, to: undefined },
  });
}
