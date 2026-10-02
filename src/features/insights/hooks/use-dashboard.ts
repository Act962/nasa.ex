"use client";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DateRange } from "@/features/insights/types";
import type { CrossBucket, CrossSeriesFilters } from "@/features/insights/lib/cross-chart-catalog";
import { mockDashboardData } from "@/features/insights/types/mock";

interface InsightFilter {
  trackingId?: string;
  organizationIds?: string[];
  startDate?: string;
  endDate?: string;
  tagIds?: string[];
  workspaceIds?: string[];
  memberIds?: string[];
}

export const useQueryAppsInsights = (input: InsightFilter) => {
  const { data, ...query } = useQuery(
    orpc.insights.getAppsInsights.queryOptions({ input }),
  );
  return { appsInsights: data, ...query };
};

/** Dados do Gráfico Cruzado: cada série com os próprios filtros (o menu do Insights não entra aqui). */
export const useQueryCrossSeries = (input: {
  bucket: CrossBucket;
  alignPeriods?: boolean;
  series: Array<{ seriesId: string; datasetId: string; filters: CrossSeriesFilters }>;
}) => {
  const { data, ...query } = useQuery({
    ...orpc.insights.getCrossSeries.queryOptions({ input }),
    enabled: input.series.length > 0,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
  return { crossSeries: data, ...query };
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
  memberIds?: string[];
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
  // "Todas as empresas" chega como lista vazia; a consulta precisa dos IDs, senão volta sem nenhum tracking.
  const { data: userOrganizations } = authClient.useListOrganizations();
  const scopedOrganizationIds =
    organizationIds.length > 0 ? organizationIds : (userOrganizations ?? []).map((organization) => organization.id);
  const { data, ...query } = useQuery({
    ...orpc.tracking.listAllTrackings.queryOptions({
      input: {
        organizationionIds: scopedOrganizationIds,
      },
    }),
    enabled: scopedOrganizationIds.length > 0,
  });

  return {
    trackings: data ?? [],
    ...query,
  };
};

export function useDashboardData({
  trackingId,
  organizationIds,
  tagIds,
  memberIds,
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
      memberIds,
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
