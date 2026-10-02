"use client";

import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { CHART_PALETTE } from "@/lib/chart-palette";
import { useQueryCrossSeries } from "@/features/insights/hooks/use-dashboard";
import {
  CROSS_AXIS_LABELS,
  CROSS_DATASETS,
  MAX_CROSS_SERIES,
  crossDatasetUnit,
  findCrossDataset,
  type CrossAxis,
  type CrossBucket,
  type CrossChartConfig,
  type CrossChartSeriesConfig,
  type CrossGlobalChartType,
  type CrossSeriesFilters,
} from "@/features/insights/lib/cross-chart-catalog";
import { SeriesFiltersPopover } from "./series-filters-popover";
import { SeriesFilterChips } from "./series-filter-chips";
import {
  CrossTooltip,
  SeriesComposedChart,
  useUnifiedRows,
  type SeriesChartType,
  type SeriesDataPoint,
} from "./series-composed-chart";

/**
 * Gráfico Cruzado do Insights: cada série escolhe o indicador e os próprios filtros (período,
 * empresas e os do App dela). Não obedece ao menu de filtros da página — os outros gráficos sim.
 */

type GlobalChartType = CrossGlobalChartType;
type CrossSeries = CrossChartSeriesConfig;

const CHART_HEIGHT_PX = 300;
const DEFAULT_DATASET_ID = "ts-leads-created";

const SERIES_TYPE_OPTIONS: Array<{ id: SeriesChartType; label: string }> = [
  { id: "bar", label: "Colunas" },
  { id: "line", label: "Linha" },
  { id: "area", label: "Área" },
];

const GLOBAL_TYPE_OPTIONS: Array<{ id: GlobalChartType; label: string }> = [
  { id: "composed", label: "Múltiplas séries" },
  { id: "pie", label: "Pizza" },
  { id: "bar-h", label: "Barras" },
];

const BUCKET_OPTIONS: Array<{ id: CrossBucket; label: string }> = [
  { id: "auto", label: "Automático" },
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
];

function createSeries(datasetId: string, seriesIndex: number, filters: CrossSeriesFilters = {}): CrossSeries {
  return {
    // ID único mesmo depois de reabrir: as séries guardadas convivem com as novas.
    id: `series-${crypto.randomUUID()}`,
    datasetId,
    chartType: seriesIndex === 0 ? "bar" : "line",
    color: CHART_PALETTE[seriesIndex % CHART_PALETTE.length],
    filters,
  };
}

function datasetOptionLabel(datasetId: string): string {
  const dataset = findCrossDataset(datasetId);
  if (!dataset) return datasetId;
  return dataset.axis === "period" ? dataset.label : `${CROSS_AXIS_LABELS[dataset.axis]} — ${dataset.label}`;
}

function PillToggle<TOption extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: TOption; label: string }>;
  value: TOption;
  onChange: (option: TOption) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === option.id ? "border-transparent bg-foreground text-background" : "border-line text-muted-foreground hover:bg-accent",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const DEFAULT_CROSS_CHART: CrossChartConfig = {
  series: [{ id: "series-default", datasetId: DEFAULT_DATASET_ID, chartType: "bar", color: CHART_PALETTE[0], filters: {} }],
  globalType: "composed",
  bucket: "auto",
  alignPeriods: false,
};

export function CrossChart() {
  // A configuração fica guardada: ao voltar, o gráfico reabre exatamente como o usuário deixou.
  const { crossChart, setCrossChart } = useDashboardStore();
  const config = crossChart ?? DEFAULT_CROSS_CHART;
  const seriesList = config.series.length > 0 ? config.series : DEFAULT_CROSS_CHART.series;
  const { globalType, bucket } = config;
  const isAligningPeriods = config.alignPeriods;
  const saveConfig = (patch: Partial<CrossChartConfig>) => setCrossChart({ ...config, series: seriesList, ...patch });
  const setSeriesList = (updater: (currentList: CrossSeries[]) => CrossSeries[]) => saveConfig({ series: updater(seriesList) });
  const setGlobalType = (nextGlobalType: GlobalChartType) => saveConfig({ globalType: nextGlobalType });
  const setBucket = (nextBucket: CrossBucket) => saveConfig({ bucket: nextBucket });
  const setIsAligningPeriods = (updater: (isAligning: boolean) => boolean) => saveConfig({ alignPeriods: updater(isAligningPeriods) });

  const leadingAxis: CrossAxis = findCrossDataset(seriesList[0]?.datasetId ?? DEFAULT_DATASET_ID)?.axis ?? "period";
  const visibleSeries = globalType === "composed" ? seriesList : seriesList.slice(0, 1);

  const { crossSeries, isFetching } = useQueryCrossSeries({
    bucket,
    alignPeriods: isAligningPeriods,
    series: visibleSeries.map((series) => ({ seriesId: series.id, datasetId: series.datasetId, filters: series.filters })),
  });
  const seriesData = (crossSeries?.seriesData ?? {}) as Record<string, SeriesDataPoint[]>;

  const { data: userOrganizations } = authClient.useListOrganizations();
  // Duas séries do mesmo indicador em empresas diferentes precisam de nomes diferentes na legenda.
  const seriesDisplayName = (series: CrossSeries) => {
    const baseName = findCrossDataset(series.datasetId)?.shortLabel ?? series.id;
    const organizationIds = series.filters.organizationIds ?? [];
    if (organizationIds.length === 0) return baseName;
    if (organizationIds.length > 1) return `${baseName} · ${organizationIds.length} empresas`;
    const organizationName = userOrganizations?.find((organization) => organization.id === organizationIds[0])?.name;
    return organizationName ? `${baseName} · ${organizationName}` : baseName;
  };
  const chartSeries = visibleSeries.map((series) => ({
    id: series.id,
    name: seriesDisplayName(series),
    unit: crossDatasetUnit(series.datasetId),
    color: series.color,
    chartType: series.chartType,
  }));
  const unifiedRows = useUnifiedRows(chartSeries, seriesData);

  const updateSeries = (seriesId: string, patch: Partial<CrossSeries>) => {
    setSeriesList((currentList) => currentList.map((series) => (series.id === seriesId ? { ...series, ...patch } : series)));
  };

  const changeDataset = (seriesIndex: number, datasetId: string) => {
    const nextAxis = findCrossDataset(datasetId)?.axis;
    setSeriesList((currentList) => {
      const updatedList = currentList.map((series, index) => (index === seriesIndex ? { ...series, datasetId } : series));
      // Trocar o eixo da 1ª série descarta as outras que não cruzam com o novo eixo.
      if (seriesIndex === 0 && nextAxis !== leadingAxis) {
        return updatedList.filter((series, index) => index === 0 || findCrossDataset(series.datasetId)?.axis === nextAxis);
      }
      return updatedList;
    });
  };

  const addSeries = () => {
    const usedDatasetIds = new Set(seriesList.map((series) => series.datasetId));
    const nextDataset =
      CROSS_DATASETS.find((dataset) => dataset.axis === leadingAxis && !usedDatasetIds.has(dataset.id)) ??
      CROSS_DATASETS.find((dataset) => dataset.axis === leadingAxis);
    if (!nextDataset) return;
    // A nova série começa com o mesmo período da 1ª, para já cruzar na mesma régua de datas.
    const leadingFilters = seriesList[0]?.filters ?? {};
    setSeriesList((currentList) => [
      ...currentList,
      createSeries(nextDataset.id, currentList.length, { startDate: leadingFilters.startDate, endDate: leadingFilters.endDate }),
    ]);
  };

  const firstSeries = visibleSeries[0];
  const firstSeriesData = firstSeries ? (seriesData[firstSeries.id] ?? []) : [];

  const renderChart = () => {
    if (globalType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
          <PieChart>
            <Pie data={firstSeriesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
              {firstSeriesData.map((point, index) => (
                <Cell key={point.name} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<CrossTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if (globalType === "bar-h") {
      return (
        <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT_PX, firstSeriesData.length * 40)}>
          <ComposedChart data={firstSeriesData} layout="vertical" margin={{ left: 90, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip content={<CrossTooltip />} />
            <Bar dataKey="value" name={findCrossDataset(firstSeries?.datasetId ?? "")?.shortLabel} radius={[0, 6, 6, 0]} fill={firstSeries?.color} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
    return <SeriesComposedChart series={chartSeries} rows={unifiedRows} heightPx={CHART_HEIGHT_PX} />;
  };

  return (
    <div className="w-full overflow-hidden rounded-[24px] bg-card">
      <div className="space-y-4 px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Gráfico Cruzado
              {isFetching && <OrbitaSpinner className="size-3.5 text-muted-foreground" />}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cada série tem o próprio período e filtros — o menu da página não altera este gráfico.
            </p>
          </div>
          <PillToggle options={GLOBAL_TYPE_OPTIONS} value={globalType} onChange={setGlobalType} />
        </div>

        <div className="space-y-2">
          {visibleSeries.map((series, seriesIndex) => {
            const dataset = findCrossDataset(series.datasetId);
            const selectableDatasets =
              seriesIndex === 0 ? CROSS_DATASETS : CROSS_DATASETS.filter((candidate) => candidate.axis === leadingAxis);
            const datasetsByAxis = (Object.keys(CROSS_AXIS_LABELS) as CrossAxis[]).map((axis) => ({
              axis,
              datasets: selectableDatasets.filter((candidate) => candidate.axis === axis),
            }));
            return (
              <div key={series.id} className="flex flex-wrap items-center gap-2 rounded-[20px] bg-background p-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: series.color }} />
                <select
                  value={series.datasetId}
                  onChange={(event) => changeDataset(seriesIndex, event.target.value)}
                  className="h-8 w-full shrink-0 rounded-full border border-line bg-card px-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring sm:w-64"
                >
                  {datasetsByAxis
                    .filter((group) => group.datasets.length > 0)
                    .map((group) => (
                      <optgroup key={group.axis} label={CROSS_AXIS_LABELS[group.axis]}>
                        {group.datasets.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {datasetOptionLabel(candidate.id)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
                {dataset && (
                  <SeriesFiltersPopover
                    dataset={dataset}
                    filters={series.filters}
                    onChange={(filters) => updateSeries(series.id, { filters })}
                  />
                )}
                <SeriesFilterChips filters={series.filters} onChange={(filters) => updateSeries(series.id, { filters })} />
                {globalType === "composed" && (
                  <PillToggle
                    options={SERIES_TYPE_OPTIONS}
                    value={series.chartType}
                    onChange={(chartType) => updateSeries(series.id, { chartType })}
                  />
                )}
                {seriesList.length > 1 && globalType === "composed" && (
                  <button
                    type="button"
                    onClick={() => setSeriesList((currentList) => currentList.filter((candidate) => candidate.id !== series.id))}
                    aria-label="Remover série"
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {globalType === "composed" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={addSeries}
              disabled={seriesList.length >= MAX_CROSS_SERIES}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <PlusIcon className="size-3.5" /> Adicionar série
            </button>
            {leadingAxis === "period" && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setIsAligningPeriods((isAligning) => !isAligning)}
                  title="Alinha cada série pelo início do próprio período, para comparar meses ou semanas diferentes"
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-medium transition-colors",
                    isAligningPeriods ? "border-transparent bg-foreground text-background" : "border-line hover:bg-accent",
                  )}
                >
                  Sobrepor períodos
                </button>
                Agrupar por
                <PillToggle options={BUCKET_OPTIONS} value={bucket} onChange={setBucket} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        {unifiedRows.length === 0 && !isFetching ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Sem dados para os filtros escolhidos.</p>
        ) : (
          renderChart()
        )}
      </div>
    </div>
  );
}
