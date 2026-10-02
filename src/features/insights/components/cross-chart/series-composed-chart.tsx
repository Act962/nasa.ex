"use client";

import { useMemo } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Gráfico de várias séries (colunas, linha ou área) alinhadas pelo rótulo do eixo X — usado no Gráfico Cruzado e nos gráficos de cada App. */

export type SeriesChartType = "bar" | "line" | "area";

export type ChartUnit = "count" | "currency" | "percent" | "hours";

export interface ChartSeriesSpec {
  id: string;
  name: string;
  color: string;
  chartType: SeriesChartType;
  /** Unidade da série; unidade diferente da 1ª série vai para o eixo Y da direita. */
  unit?: ChartUnit;
}

const LEFT_AXIS_ID = "left";
const RIGHT_AXIS_ID = "right";

export function formatChartValue(value: number, unit: ChartUnit = "count"): string {
  if (unit === "currency") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (unit === "percent") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (unit === "hours") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return value.toLocaleString("pt-BR");
}

function formatAxisTick(value: number, unit: ChartUnit): string {
  if (unit === "currency") {
    return value >= 1000 ? `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${value}`;
  }
  return formatChartValue(value, unit);
}

export interface SeriesDataPoint {
  name: string;
  value: number;
}

export function CrossTooltip({
  active,
  payload,
  label,
  unitBySeriesName,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; fill?: string }>;
  label?: string;
  unitBySeriesName?: Record<string, ChartUnit>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="space-y-1 rounded-[14px] border border-line bg-popover px-3 py-2.5 text-xs shadow-lg">
      <p className="font-semibold">{label}</p>
      {payload.map((point) => (
        <div key={point.name} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: point.color ?? point.fill }} />
          <span className="text-muted-foreground">{point.name}:</span>
          <span className="font-semibold">{formatChartValue(Number(point.value), unitBySeriesName?.[point.name])}</span>
        </div>
      ))}
    </div>
  );
}

/** Junta as séries numa tabela por rótulo do eixo X, na ordem em que os rótulos aparecem. */
export function useUnifiedRows(series: ChartSeriesSpec[], seriesData: Record<string, SeriesDataPoint[]>) {
  return useMemo(() => {
    const orderedNames: string[] = [];
    for (const spec of series) {
      for (const point of seriesData[spec.id] ?? []) {
        if (!orderedNames.includes(point.name)) orderedNames.push(point.name);
      }
    }
    return orderedNames.map((name) => {
      const row: Record<string, string | number> = { name };
      for (const spec of series) {
        row[spec.id] = (seriesData[spec.id] ?? []).find((point) => point.name === name)?.value ?? 0;
      }
      return row;
    });
  }, [series, seriesData]);
}

export function SeriesComposedChart({
  series,
  rows,
  heightPx,
}: {
  series: ChartSeriesSpec[];
  rows: Array<Record<string, string | number>>;
  heightPx: number;
}) {
  // Grandezas diferentes (R$ × quantidade) no mesmo eixo achatam a menor no zero: a 2ª unidade ganha eixo próprio.
  const leftUnit = series[0]?.unit ?? "count";
  const axisIdOf = (spec: ChartSeriesSpec) => ((spec.unit ?? "count") === leftUnit ? LEFT_AXIS_ID : RIGHT_AXIS_ID);
  const rightUnit = series.find((spec) => axisIdOf(spec) === RIGHT_AXIS_ID)?.unit;
  const unitBySeriesName = Object.fromEntries(series.map((spec) => [spec.name, spec.unit ?? "count"])) as Record<string, ChartUnit>;

  return (
    <ResponsiveContainer width="100%" height={heightPx}>
      <ComposedChart data={rows} margin={{ left: 0, right: rightUnit ? 0 : 20, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis yAxisId={LEFT_AXIS_ID} tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatAxisTick(value, leftUnit)} width={leftUnit === "currency" ? 72 : 48} />
        {rightUnit && (
          <YAxis
            yAxisId={RIGHT_AXIS_ID}
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={(value: number) => formatAxisTick(value, rightUnit)}
            width={rightUnit === "currency" ? 72 : 48}
          />
        )}
        <Tooltip content={<CrossTooltip unitBySeriesName={unitBySeriesName} />} />
        <Legend />
        {series.map((spec) => {
          const yAxisId = axisIdOf(spec);
          if (spec.chartType === "line") {
            return <Line key={spec.id} yAxisId={yAxisId} type="monotone" dataKey={spec.id} name={spec.name} stroke={spec.color} strokeWidth={2.5} dot={{ r: 3, fill: spec.color }} />;
          }
          if (spec.chartType === "area") {
            return <Area key={spec.id} yAxisId={yAxisId} type="monotone" dataKey={spec.id} name={spec.name} stroke={spec.color} strokeWidth={2} fill={spec.color} fillOpacity={0.15} />;
          }
          return <Bar key={spec.id} yAxisId={yAxisId} dataKey={spec.id} name={spec.name} fill={spec.color} radius={[5, 5, 0, 0]} maxBarSize={48} />;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
