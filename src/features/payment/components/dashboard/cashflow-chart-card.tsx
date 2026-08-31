"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisCurrency, formatCurrency } from "../../lib/format";

export type CashflowPoint = {
  name: string;
  Receitas: number;
  Despesas: number;
  Saldo: number;
};

const SERIES = [
  { key: "Receitas", color: "#10b981" },
  { key: "Despesas", color: "#ef4444" },
  { key: "Saldo", color: "#3b82f6" },
] as const;

const tooltipStyle = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
};

export function CashflowChartCard({
  points,
  granularity,
  onGranularityChange,
}: {
  points: CashflowPoint[];
  granularity: "monthly" | "daily";
  onGranularityChange: (value: "monthly" | "daily") => void;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b p-4 sm:p-5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold">
          <TrendingUp className="size-4 shrink-0 text-blue-500" />
          <span className="truncate">Fluxo de Caixa</span>
        </CardTitle>
        <Select
          value={granularity}
          onValueChange={(value) =>
            onGranularityChange(value as "monthly" | "daily")
          }
        >
          <SelectTrigger className="h-8 w-28 shrink-0 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="daily">Diário</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {SERIES.map((serie) => (
            <span
              key={serie.key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: serie.color }}
              />
              {serie.key}
            </span>
          ))}
        </div>

        {points.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhum movimento no período selecionado.
          </p>
        ) : (
          <div className="h-[240px] w-full sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={62}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value: number) => formatAxisCurrency(value)}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name) => [
                    formatCurrency(value),
                    name,
                  ]}
                />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#3b82f6" }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
