"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_PALETTE } from "@/lib/chart-palette";
import type { FrozenChart } from "@/features/insights/hooks/use-charts-snapshot";
import { CrossTooltip, SeriesComposedChart, useUnifiedRows } from "./series-composed-chart";

/** Gráfico congelado no relatório salvo: mesma aparência do painel, com os números do momento em que foi salvo. */
export function FrozenChartCard({
  chart,
  globalType = "composed",
  heightPx = 280,
}: {
  chart: FrozenChart;
  globalType?: "composed" | "pie" | "bar-h";
  heightPx?: number;
}) {
  const rows = useUnifiedRows(chart.series, chart.seriesData);
  const firstSeries = chart.series[0];
  const firstSeriesData = firstSeries ? (chart.seriesData[firstSeries.id] ?? []) : [];

  const renderChart = () => {
    if (globalType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={heightPx}>
          <PieChart>
            <Pie data={firstSeriesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {firstSeriesData.map((point, pointIndex) => (
                <Cell key={point.name} fill={CHART_PALETTE[pointIndex % CHART_PALETTE.length]} />
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
        <ResponsiveContainer width="100%" height={Math.max(heightPx, firstSeriesData.length * 40)}>
          <ComposedChart data={firstSeriesData} layout="vertical" margin={{ left: 90, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip content={<CrossTooltip />} />
            <Bar dataKey="value" name={firstSeries?.name} radius={[0, 6, 6, 0]} fill={firstSeries?.color} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
    return <SeriesComposedChart series={chart.series} rows={rows} heightPx={heightPx} />;
  };

  return (
    <div className="space-y-2 rounded-[24px] border bg-card p-4">
      <p className="text-sm font-semibold">{chart.title}</p>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">Sem dados no período salvo.</p>
      ) : (
        renderChart()
      )}
    </div>
  );
}
