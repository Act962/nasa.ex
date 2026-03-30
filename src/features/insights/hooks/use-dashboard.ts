"use client";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DateRange } from "@/features/insights/types";
import { mockDashboardData } from "@/features/insights/types/mock";

interface InsightFilter {
  trackingId?: string;
  organizationIds?: string[];
  startDate?: string;
  endDate?: string;
  tagIds?: string[];
}

export const useQueryAppsInsights = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getAppsInsights.queryOptions({ input }),
  );
  return { appsInsights: data, ...query };
};

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
  organizationIds?: string[];
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
export const useQueryListAllTrackings = (organizationIds: string[]) => {
  const { data, ...query } = useQuery(
    orpc.tracking.listAllTrackings.queryOptions({
      input: {
        organizationionIds: organizationIds,
      },
    }),
  );

  return {
    trackings: data ?? [],
    ...query,
  };
};

export function useDashboardData({
  trackingId,
  organizationIds,
  tagIds,
  dateRange,
}: UseDashboardDataOptions) {
  const startDate = dateRange.from?.toISOString();
  const endDate = dateRange.to?.toISOString();

  const { report, isLoading, isRefetching, refetch } =
    useQueryTrackingDashboardReport({
      trackingId,
      organizationIds,
      startDate,
      endDate,
      tagIds,
    });

  return {
    data: report ?? mockDashboardData, //Aqui há dados mocados para não querar por enquanto que nn quebre
    error: null,
    isLoading,
    isValidating: isRefetching,
    refresh: () => refetch(),
  };
}

export const useMutationShareInsights = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.insights.createShareInsights.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.insights.listInsightShares.queryKey({}),
        });
      },
    }),
  );
};

export function useQueryListInsightShares() {
  const { data, ...query } = useQuery(
    orpc.insights.listInsightShares.queryOptions({}),
  );

  return {
    shares: data ?? [],
    ...query,
  };
}

export function useDeleteInsightShares() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.insights.deleteInsight.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.insights.listInsightShares.queryKey({}),
        });
      },
    }),
  );
}
