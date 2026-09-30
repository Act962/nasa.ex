"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface RegularityHistoryChartProps {
  points: Array<{ date: Date | string; scoreBps: number }>;
  strokeColor: string;
}

function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function RegularityHistoryChart({ points, strokeColor }: RegularityHistoryChartProps) {
  const chartData = points.map((point) => ({
    dateLabel: formatShortDate(point.date),
    scorePercent: Math.round(point.scoreBps / 100),
  }));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip
            formatter={(value) => [`${value}%`, "Score"]}
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              border: "1px solid var(--border)",
            }}
          />
          <Line type="monotone" dataKey="scorePercent" stroke={strokeColor} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
