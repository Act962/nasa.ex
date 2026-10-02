"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  chartColor,
  formatChartValue,
  type AstroChartPayload,
} from "@/features/astro/lib/astro-chart";

/**
 * Renderiza um gráfico Astro (bar/line/pie) dentro da mensagem.
 * Usa recharts (mesma lib do /insights) pra visual consistente.
 *
 * Container fixo (`h-64`) — recharts precisa de altura definida.
 * Tooltip e legendas em pt-BR; valores formatados via `valueFormat`.
 */
export function AstroChartCard({ payload }: { payload: AstroChartPayload }) {
  const isEmpty = payload.data.length === 0;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-line/80 bg-card/40">
      <div className="border-b border-line/80 px-3 py-2">
        <div className="text-xs font-semibold text-foreground">
          {payload.title}
        </div>
        {payload.caption && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {payload.caption}
          </div>
        )}
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center h-32 px-3 py-2 text-xs text-muted-foreground italic">
          Sem dados pra esse gráfico no período.
        </div>
      ) : (
        // Medimos width via ResizeObserver e passamos explícito pro
        // recharts. Antes usávamos ResponsiveContainer, mas durante o
        // streaming do chat ele mede o pai como 0 e nunca re-mede —
        // chart fica invisível.
        <MeasuredChart payload={payload} />
      )}
    </div>
  );
}

function MeasuredChart({ payload }: { payload: AstroChartPayload }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 280;

  return (
    <div ref={ref} className="w-full p-3" style={{ minWidth: 0 }}>
      {width > 0 ? renderChart(payload, width, height) : (
        <div className="h-[280px]" />
      )}
    </div>
  );
}

function renderChart(payload: AstroChartPayload, width: number, height: number) {
  // chartArea = um pouco menor que width pra dar respiro nas margens.
  const w = Math.max(200, Math.floor(width));
  switch (payload.chartType) {
    case "bar":
      return <RenderBar payload={payload} width={w} height={height} />;
    case "line":
      return <RenderLine payload={payload} width={w} height={height} />;
    case "pie":
      return <RenderPie payload={payload} width={w} height={height} />;
    default:
      return <RenderBar payload={payload} width={w} height={height} />;
  }
}

function tooltipFormatter(
  value: unknown,
  fmt: AstroChartPayload["valueFormat"],
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return formatChartValue(n, fmt);
}

function RenderBar({
  payload,
  width,
  height,
}: {
  payload: AstroChartPayload;
  width: number;
  height: number;
}) {
  return (
    <BarChart width={width} height={height} data={payload.data}>
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        axisLine={{ stroke: "var(--line)" }}
        tickLine={{ stroke: "var(--line)" }}
      />
      <YAxis
        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        axisLine={{ stroke: "var(--line)" }}
        tickLine={{ stroke: "var(--line)" }}
        tickFormatter={(v) => tooltipFormatter(v, payload.valueFormat)}
      />
      <Tooltip
        contentStyle={{
          background: "var(--popover)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontSize: 12,
        }}
        labelStyle={{ color: "var(--popover-foreground)" }}
        formatter={(value: unknown) => [
          tooltipFormatter(value, payload.valueFormat),
          payload.yLabel ?? "Valor",
        ]}
      />
      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
        {payload.data.map((_, i) => (
          <Cell key={i} fill={chartColor(i)} />
        ))}
      </Bar>
    </BarChart>
  );
}

function RenderLine({
  payload,
  width,
  height,
}: {
  payload: AstroChartPayload;
  width: number;
  height: number;
}) {
  return (
    <LineChart width={width} height={height} data={payload.data}>
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        axisLine={{ stroke: "var(--line)" }}
        tickLine={{ stroke: "var(--line)" }}
      />
      <YAxis
        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        axisLine={{ stroke: "var(--line)" }}
        tickLine={{ stroke: "var(--line)" }}
        tickFormatter={(v) => tooltipFormatter(v, payload.valueFormat)}
      />
      <Tooltip
        contentStyle={{
          background: "var(--popover)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontSize: 12,
        }}
        labelStyle={{ color: "var(--popover-foreground)" }}
        formatter={(value: unknown) => [
          tooltipFormatter(value, payload.valueFormat),
          payload.yLabel ?? "Valor",
        ]}
      />
      <Line
        type="monotone"
        dataKey="value"
        stroke="var(--chart-2)"
        strokeWidth={2}
        dot={{ fill: "var(--chart-2)", r: 3 }}
        activeDot={{ r: 5 }}
      />
    </LineChart>
  );
}

function RenderPie({
  payload,
  width,
  height,
}: {
  payload: AstroChartPayload;
  width: number;
  height: number;
}) {
  return (
    <PieChart width={width} height={height}>
      <Pie
        data={payload.data}
        dataKey="value"
        nameKey="label"
        cx="50%"
        cy="50%"
        outerRadius={80}
        innerRadius={40}
        paddingAngle={2}
      >
        {payload.data.map((_, i) => (
          <Cell key={i} fill={chartColor(i)} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={{
          background: "var(--popover)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontSize: 12,
        }}
        labelStyle={{ color: "var(--popover-foreground)" }}
        formatter={(value: unknown) => [
          tooltipFormatter(value, payload.valueFormat),
          "Quantidade",
        ]}
      />
      <Legend
        verticalAlign="bottom"
        height={36}
        wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
      />
    </PieChart>
  );
}
