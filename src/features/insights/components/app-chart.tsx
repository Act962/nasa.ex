"use client";

import { useState } from "react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { CHART_PALETTE } from "@/lib/chart-palette";
import type { AppModule } from "@/features/insights/types";
import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";
import { useQueryCrossSeries } from "@/features/insights/hooks/use-dashboard";
import {
  CROSS_AXIS_LABELS,
  CROSS_DATASETS,
  crossDatasetUnit,
  type AppChartConfig,
  type CrossAxis,
  type CrossSeriesFilters,
} from "@/features/insights/lib/cross-chart-catalog";
import {
  SeriesComposedChart,
  useUnifiedRows,
  type SeriesChartType,
  type SeriesDataPoint,
} from "./cross-chart/series-composed-chart";

/**
 * Gráfico próprio de cada App no Insights: só os indicadores daquele App, obedecendo ao menu de
 * filtros da página (empresas, tracking, tags, status, atendentes, workspaces e período).
 */

const CHART_HEIGHT_PX = 240;
const MAX_APP_SERIES = 4;
const DEFAULT_SERIES_COUNT = 2;
const NO_MENU_PERIOD_DAYS = 90;
const DAY_MS = 1000 * 60 * 60 * 24;

const CHART_TYPE_OPTIONS: Array<{ id: SeriesChartType; label: string }> = [
  { id: "bar", label: "Colunas" },
  { id: "line", label: "Linha" },
  { id: "area", label: "Área" },
];

function startOfDayDaysAgo(daysAgo: number): string {
  const startDate = new Date(Date.now() - daysAgo * DAY_MS);
  startDate.setHours(0, 0, 0, 0);
  return startDate.toISOString();
}

export function useMenuSeriesFilters(): CrossSeriesFilters {
  const { organizationIds, trackingId, tagIds, statusIds, memberIds, workspaceIds, dateRange } = useDashboardStore();
  // Calculada uma vez: recalcular a cada render mudaria a chave da consulta e o gráfico buscaria sem parar.
  const [fallbackStartDate] = useState(() => startOfDayDaysAgo(NO_MENU_PERIOD_DAYS));
  return {
    // Sem período no menu, o gráfico mostra os últimos 90 dias (os cartões continuam sem limite de data).
    startDate: dateRange.from?.toISOString() ?? fallbackStartDate,
    endDate: dateRange.to?.toISOString(),
    organizationIds,
    trackingIds: trackingId && trackingId !== "ALL" ? [trackingId] : undefined,
    tagIds,
    statusIds,
    memberIds,
    workspaceIds,
  };
}

export function AppChart({ appModule }: { appModule: AppModule }) {
  const appDatasets = CROSS_DATASETS.filter((dataset) => dataset.appModule === appModule);
  const availableAxes = (Object.keys(CROSS_AXIS_LABELS) as CrossAxis[]).filter((axis) =>
    appDatasets.some((dataset) => dataset.axis === axis),
  );
  // Escolhas guardadas por App: ao voltar, o gráfico reabre como o usuário deixou.
  const { appCharts, setAppChart } = useDashboardStore();
  const defaultAxis = availableAxes[0] ?? "period";
  const savedConfig = appCharts[appModule];
  const axis: CrossAxis = savedConfig && availableAxes.includes(savedConfig.axis) ? savedConfig.axis : defaultAxis;
  const axisDatasets = appDatasets.filter((dataset) => dataset.axis === axis);
  const selectedDatasetIds =
    savedConfig?.datasetIds ??
    appDatasets.filter((dataset) => dataset.axis === defaultAxis).slice(0, DEFAULT_SERIES_COUNT).map((dataset) => dataset.id);
  const chartType: SeriesChartType = savedConfig?.chartType ?? "bar";
  const saveConfig = (patch: Partial<AppChartConfig>) =>
    setAppChart(appModule, { axis, datasetIds: selectedDatasetIds, chartType, ...patch });
  const menuFilters = useMenuSeriesFilters();

  const activeDatasetIds = selectedDatasetIds.filter((datasetId) => axisDatasets.some((dataset) => dataset.id === datasetId));
  const { crossSeries, isFetching } = useQueryCrossSeries({
    bucket: "auto",
    series: activeDatasetIds.map((datasetId) => ({ seriesId: datasetId, datasetId, filters: menuFilters })),
  });
  const seriesData = (crossSeries?.seriesData ?? {}) as Record<string, SeriesDataPoint[]>;
  const chartSeries = activeDatasetIds.map((datasetId, seriesIndex) => ({
    id: datasetId,
    name: axisDatasets.find((dataset) => dataset.id === datasetId)?.shortLabel ?? datasetId,
    color: CHART_PALETTE[seriesIndex % CHART_PALETTE.length],
    unit: crossDatasetUnit(datasetId),
    // A 1ª série segue o tipo escolhido; as demais viram linha para não empilhar colunas ilegíveis.
    chartType: seriesIndex === 0 ? chartType : "line",
  }));
  const unifiedRows = useUnifiedRows(chartSeries, seriesData);

  if (appDatasets.length === 0) return null;

  const changeAxis = (nextAxis: CrossAxis) => {
    saveConfig({
      axis: nextAxis,
      datasetIds: appDatasets.filter((dataset) => dataset.axis === nextAxis).slice(0, DEFAULT_SERIES_COUNT).map((dataset) => dataset.id),
    });
  };

  const setChartType = (nextChartType: SeriesChartType) => saveConfig({ chartType: nextChartType });

  const toggleDataset = (datasetId: string) => {
    const activeIds = selectedDatasetIds.filter((selectedId) => axisDatasets.some((dataset) => dataset.id === selectedId));
    if (activeIds.includes(datasetId)) {
      if (activeIds.length > 1) saveConfig({ datasetIds: activeIds.filter((activeId) => activeId !== datasetId) });
      return;
    }
    if (activeIds.length < MAX_APP_SERIES) saveConfig({ datasetIds: [...activeIds, datasetId] });
  };

  return (
    <div className="space-y-3 rounded-[24px] bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold">
          Evolução
          {isFetching && <OrbitaSpinner className="size-3.5 text-muted-foreground" />}
        </p>
        <div className="flex flex-wrap gap-1">
          {availableAxes.length > 1 &&
            availableAxes.map((availableAxis) => (
              <button
                key={availableAxis}
                type="button"
                onClick={() => changeAxis(availableAxis)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  axis === availableAxis ? "border-transparent bg-foreground text-background" : "border-line text-muted-foreground hover:bg-accent",
                )}
              >
                {CROSS_AXIS_LABELS[availableAxis]}
              </button>
            ))}
          {CHART_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setChartType(option.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                chartType === option.id ? "border-transparent bg-foreground text-background" : "border-line text-muted-foreground hover:bg-accent",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {axisDatasets.map((dataset) => {
          const seriesIndex = activeDatasetIds.indexOf(dataset.id);
          const isSelected = seriesIndex >= 0;
          return (
            <button
              key={dataset.id}
              type="button"
              onClick={() => toggleDataset(dataset.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                isSelected ? "border-foreground/40 font-medium" : "border-line text-muted-foreground hover:bg-accent",
              )}
            >
              {isSelected && (
                <span className="size-2 rounded-full" style={{ background: CHART_PALETTE[seriesIndex % CHART_PALETTE.length] }} />
              )}
              {dataset.shortLabel}
            </button>
          );
        })}
      </div>

      {unifiedRows.length === 0 && !isFetching ? (
        <p className="py-10 text-center text-xs text-muted-foreground">Sem dados para os filtros do menu.</p>
      ) : (
        <SeriesComposedChart series={chartSeries} rows={unifiedRows} heightPx={CHART_HEIGHT_PX} />
      )}
    </div>
  );
}
