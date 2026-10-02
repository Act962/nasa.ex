"use client";

import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { CHART_PALETTE } from "@/lib/chart-palette";
import type { AppModule } from "@/features/insights/types";
import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";
import { useMenuSeriesFilters } from "@/features/insights/components/app-chart";
import {
  CROSS_AXIS_LABELS,
  CROSS_DATASETS,
  crossDatasetUnit,
  findCrossDataset,
  type CrossAxis,
  type CrossChartConfig,
  type CrossSeriesChartType,
} from "@/features/insights/lib/cross-chart-catalog";

/**
 * Congela, no momento de salvar o relatório, o Gráfico Cruzado e os gráficos "Evolução" de cada App:
 * a configuração e os números daquele instante — o relatório salvo não muda depois.
 */

export interface FrozenChartSeries {
  id: string;
  name: string;
  color: string;
  chartType: CrossSeriesChartType;
  unit: ReturnType<typeof crossDatasetUnit>;
}

export interface FrozenChart {
  title: string;
  series: FrozenChartSeries[];
  seriesData: Record<string, Array<{ name: string; value: number }>>;
}

export interface ChartsSnapshot {
  crossChart?: FrozenChart & { globalType: CrossChartConfig["globalType"] };
  appCharts: Partial<Record<AppModule, FrozenChart>>;
}

const DEFAULT_APP_SERIES_COUNT = 2;

export function useChartsSnapshot() {
  const queryClient = useQueryClient();
  const { crossChart, appCharts } = useDashboardStore();
  const menuFilters = useMenuSeriesFilters();
  const { data: userOrganizations } = authClient.useListOrganizations();

  const fetchSeries = (input: Parameters<typeof orpc.insights.getCrossSeries.queryOptions>[0]["input"]) =>
    queryClient.fetchQuery(orpc.insights.getCrossSeries.queryOptions({ input }));

  const organizationSuffix = (organizationIds?: string[]) => {
    if (!organizationIds || organizationIds.length === 0) return "";
    if (organizationIds.length > 1) return ` · ${organizationIds.length} empresas`;
    const organizationName = userOrganizations?.find((organization) => organization.id === organizationIds[0])?.name;
    return organizationName ? ` · ${organizationName}` : "";
  };

  return async function captureChartsSnapshot(selectedModules: AppModule[]): Promise<ChartsSnapshot> {
    const snapshot: ChartsSnapshot = { appCharts: {} };

    if (crossChart && crossChart.series.length > 0) {
      const visibleSeries = crossChart.globalType === "composed" ? crossChart.series : crossChart.series.slice(0, 1);
      const result = await fetchSeries({
        bucket: crossChart.bucket,
        alignPeriods: crossChart.alignPeriods,
        series: visibleSeries.map((series) => ({ seriesId: series.id, datasetId: series.datasetId, filters: series.filters })),
      });
      snapshot.crossChart = {
        title: "Gráfico Cruzado",
        globalType: crossChart.globalType,
        series: visibleSeries.map((series) => ({
          id: series.id,
          name: `${findCrossDataset(series.datasetId)?.shortLabel ?? series.id}${organizationSuffix(series.filters.organizationIds)}`,
          color: series.color,
          chartType: series.chartType,
          unit: crossDatasetUnit(series.datasetId),
        })),
        seriesData: result.seriesData as FrozenChart["seriesData"],
      };
    }

    for (const appModule of selectedModules) {
      const appDatasets = CROSS_DATASETS.filter((dataset) => dataset.appModule === appModule);
      if (appDatasets.length === 0) continue;
      const savedConfig = appCharts[appModule];
      const axis: CrossAxis = savedConfig?.axis ?? appDatasets[0].axis;
      const datasetIds = (
        savedConfig?.datasetIds ??
        appDatasets.filter((dataset) => dataset.axis === axis).slice(0, DEFAULT_APP_SERIES_COUNT).map((dataset) => dataset.id)
      ).filter((datasetId) => findCrossDataset(datasetId)?.axis === axis);
      if (datasetIds.length === 0) continue;
      const result = await fetchSeries({
        bucket: "auto",
        series: datasetIds.map((datasetId) => ({ seriesId: datasetId, datasetId, filters: menuFilters })),
      });
      snapshot.appCharts[appModule] = {
        title: axis === "period" ? "Evolução" : `Evolução — ${CROSS_AXIS_LABELS[axis]}`,
        series: datasetIds.map((datasetId, seriesIndex) => ({
          id: datasetId,
          name: findCrossDataset(datasetId)?.shortLabel ?? datasetId,
          color: CHART_PALETTE[seriesIndex % CHART_PALETTE.length],
          chartType: seriesIndex === 0 ? (savedConfig?.chartType ?? "bar") : "line",
          unit: crossDatasetUnit(datasetId),
        })),
        seriesData: result.seriesData as FrozenChart["seriesData"],
      };
    }

    return snapshot;
  };
}
