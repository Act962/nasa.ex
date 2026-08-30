"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "../../lib/format";

const SLICE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#94a3b8",
];

const MAX_SLICES = 5;

export type CategorySlice = { name: string; value: number };

/** Top 5 categorias; o resto vira uma fatia "Outros" pra não poluir o donut. */
function groupSlices(items: CategorySlice[]): CategorySlice[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES + 1) return sorted;

  const head = sorted.slice(0, MAX_SLICES);
  const othersTotal = sorted
    .slice(MAX_SLICES)
    .reduce((sum, item) => sum + item.value, 0);
  return [...head, { name: "Outros", value: othersTotal }];
}

export function ExpensesByCategoryCard({ items }: { items: CategorySlice[] }) {
  const slices = groupSlices(items);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b p-4 sm:p-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <PieChartIcon className="size-4 shrink-0 text-violet-500" />
          <span className="truncate">Gastos por Categoria</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <PieChartIcon className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">
              Nenhuma despesa paga no período selecionado.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center">
            <div className="relative size-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="64%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {slices.map((slice, index) => (
                      <Cell
                        key={slice.name}
                        fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name) => [
                      formatCurrency(value),
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold tabular-nums">
                  {formatCurrency(total)}
                </span>
                <span className="text-[11px] text-muted-foreground">Total</span>
              </div>
            </div>

            <ul className="w-full min-w-0 flex-1 space-y-2.5">
              {slices.map((slice, index) => (
                <li
                  key={slice.name}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      background: SLICE_COLORS[index % SLICE_COLORS.length],
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate" title={slice.name}>
                    {slice.name}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(slice.value)}
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {formatPercent((slice.value / total) * 100)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
