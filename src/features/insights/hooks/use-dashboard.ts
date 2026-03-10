"use client";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { DateRange } from "@/features/insights/types";
import { mockDashboardData } from "@/features/insights/types/mock";

interface InsightFilter {
  trackingId?: string;
  startDate?: string;
  endDate?: string;
  tagIds?: string[];
}

export const useQueryTrackingDashboardReport = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getTrackingDashboardReport.queryOptions({ input }),
  );

  return {
    report: data,
    ...query,
  };
};

interface UseDashboardDataOptions {
  trackingId?: string;
  tagIds?: string[];
  dateRange: DateRange;
}

export const useQueryListTrackings = () => {
  const { data, ...query } = useQuery(orpc.tracking.list.queryOptions({}));

  return {
    trackings: data ?? [],
    ...query,
  };
};

export function useDashboardData({
  trackingId,
  tagIds,
  dateRange,
}: UseDashboardDataOptions) {
  const startDate = dateRange.from?.toISOString();
  const endDate = dateRange.to?.toISOString();

  const { report, isLoading, isRefetching, refetch } =
    useQueryTrackingDashboardReport({
      trackingId,
      startDate,
      endDate,
      tagIds,
    });

  return {
    data: report ?? mockDashboardData,
    error: null,
    isLoading,
    isValidating: isRefetching,
    refresh: () => refetch(),
  };
}
