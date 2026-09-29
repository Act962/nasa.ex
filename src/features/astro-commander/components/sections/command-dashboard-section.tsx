"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis } from "recharts";
import { Activity, Clock, Star } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAstroUsage } from "@/features/astro-commander/hooks/use-astro-runs";

/** Dashboard do comando (spec 0028, RF-19). */

const CHART_CONFIG = {
  runs: { label: "Execuções", color: "var(--primary)" },
} satisfies ChartConfig;

const RESULT_COLORS = {
  succeeded: "hsl(142, 71%, 45%)",
  waiting: "hsl(38, 92%, 50%)",
  failed: "hsl(0, 84%, 60%)",
  skipped: "hsl(220, 9%, 60%)",
};

export function CommandDashboardSection({ commandId }: { commandId: string }) {
  const [days, setDays] = useState("7");
  const { usage, isLoading } = useAstroUsage({ commandId, days: Number(days) });

  if (isLoading || !usage) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const resultData = [
    { key: "succeeded", label: "Concluídas", value: usage.succeeded },
    { key: "waiting", label: "Aguardando", value: usage.waitingApproval },
    { key: "failed", label: "Falhas", value: usage.failed },
    { key: "skipped", label: "Puladas", value: usage.skipped },
  ].filter((slice) => slice.value > 0);

  const chartData = usage.byDay.map((day) => ({
    label: new Date(`${day.date}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    }),
    runs: day.runs,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-10 w-36 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Hoje</SelectItem>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Activity className="size-5" />}
          label="Execuções"
          value={usage.totalRuns.toLocaleString("pt-BR")}
        />
        <MetricCard
          icon={<Clock className="size-5" />}
          label="Aguardando aprovação"
          value={usage.waitingApproval.toLocaleString("pt-BR")}
        />
        <MetricCard
          icon={<Star className="size-5" />}
          label="Stars gastas"
          value={usage.stars.toLocaleString("pt-BR")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Execuções no período</p>
          <p className="mb-4 text-2xl font-semibold">
            {usage.totalRuns.toLocaleString("pt-BR")}
          </p>
          <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
            <AreaChart data={chartData} margin={{ left: 4, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
              />
              <ChartTooltip />
              <Area
                dataKey="runs"
                type="monotone"
                stroke="var(--color-runs)"
                fill="var(--color-runs)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="mb-2 text-sm font-medium">Resultado</p>
          {resultData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Sem execuções no período.
            </p>
          ) : (
            <>
              <ChartContainer config={CHART_CONFIG} className="mx-auto h-52">
                <PieChart>
                  <Pie
                    data={resultData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={82}
                    strokeWidth={4}
                  >
                    {resultData.map((slice) => (
                      <Cell
                        key={slice.key}
                        fill={RESULT_COLORS[slice.key as keyof typeof RESULT_COLORS]}
                      />
                    ))}
                    <Label
                      position="center"
                      value={`${Math.round(usage.successRate * 100)}%`}
                      className="fill-foreground text-2xl font-semibold"
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>

              <ul className="space-y-2 text-sm">
                {resultData.map((slice) => (
                  <li key={slice.key} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2.5 rounded-full"
                        style={{
                          background:
                            RESULT_COLORS[slice.key as keyof typeof RESULT_COLORS],
                        }}
                      />
                      {slice.label}
                    </span>
                    <span>{slice.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}
