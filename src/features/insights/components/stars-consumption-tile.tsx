"use client";

/**
 * Tile do Insights — Consumo de STARs.
 *
 * Mostra:
 *  - Total consumido no ciclo + saldo restante + projeção pra fim do ciclo
 *  - Gráfico de linha: consumo diário (procedure `stars.getDailyConsumption`)
 *  - Gráfico de barras: top 10 apps por consumo (procedure
 *    `stars.getUsageBreakdown` — agora retorna todos os apps, slice 0..10)
 *
 * Reusa Recharts já presente no projeto (mesma stack do
 * `customizable-chart.tsx`).
 */

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StarIcon } from "@/features/stars/components/star-icon";
import { TrendingUp, AlertTriangle, ShieldAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import dayjs from "dayjs";

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function StarsConsumptionTile() {
  const { data: balance, isLoading: loadingBalance } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    refetchInterval: 60_000,
  });
  const { data: usage, isLoading: loadingUsage } = useQuery({
    ...orpc.stars.getUsageBreakdown.queryOptions(),
    refetchInterval: 60_000,
  });
  const { data: daily, isLoading: loadingDaily } = useQuery({
    ...orpc.stars.getDailyConsumption.queryOptions(),
    refetchInterval: 60_000,
  });

  if (loadingBalance || loadingUsage || loadingDaily) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StarIcon className="size-4" /> Consumo de STARs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const planMonthly = balance?.planMonthlyStars ?? 0;
  const remaining = balance?.balance ?? 0;
  const consumed = daily?.totalConsumed ?? usage?.consumedInCycle ?? 0;
  const projection = daily?.projection ?? 0;
  const pctUsed = planMonthly > 0 ? (consumed / planMonthly) * 100 : 0;
  const isCritical = planMonthly > 0 && pctUsed >= 90;
  const isLow = planMonthly > 0 && pctUsed >= 70 && !isCritical;

  const graceStartedAt = balance?.graceStartedAt
    ? new Date(balance.graceStartedAt)
    : null;
  const suspendedAt = balance?.suspendedAt
    ? new Date(balance.suspendedAt)
    : null;

  // Top 10 apps por consumo.
  const topApps = (usage?.byApp ?? []).slice(0, 10).map((a) => ({
    label: a.label,
    total: a.total,
  }));

  // Série diária formatada pra dd/MM.
  const dailySeries = (daily?.series ?? []).map((d) => ({
    day: dayjs(d.date).format("DD/MM"),
    total: d.total,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <StarIcon className="size-4" /> Consumo de STARs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alertas — exibidos antes dos gráficos pra chamar atenção. */}
        {suspendedAt && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200/60 p-3 dark:bg-red-950/20 dark:border-red-900/40">
            <ShieldAlert className="size-4 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 dark:text-red-300">
              <strong>Conta suspensa.</strong> Recarregue para reativar as
              integrações pagas.
            </div>
          </div>
        )}
        {!suspendedAt && graceStartedAt && (
          <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200/60 p-3 dark:bg-orange-950/20 dark:border-orange-900/40">
            <AlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-xs text-orange-700 dark:text-orange-300">
              <strong>Saldo zerou.</strong> Você está em período de carência —
              recarregue antes da suspensão.
            </div>
          </div>
        )}

        {/* KPIs ── consumido / restante / projeção */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">
              Consumido
            </p>
            <p className="text-lg font-bold tabular-nums">{fmt(consumed)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">
              Restante
            </p>
            <p className="text-lg font-bold tabular-nums">{fmt(remaining)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">
              Plano (ciclo)
            </p>
            <p className="text-lg font-bold tabular-nums">
              {planMonthly > 0 ? fmt(planMonthly) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3" /> Projeção
            </p>
            <p
              className={
                "text-lg font-bold tabular-nums " +
                (isCritical
                  ? "text-red-500"
                  : isLow
                    ? "text-amber-500"
                    : "")
              }
            >
              {fmt(projection)}
            </p>
          </div>
        </div>

        {/* Gráfico diário */}
        {dailySeries.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Consumo diário (ciclo atual)
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  formatter={(v: number) => [`${fmt(v)} ★`, "Consumido"]}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico por app */}
        {topApps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Top 10 apps por consumo
            </p>
            <ResponsiveContainer width="100%" height={Math.max(160, topApps.length * 24)}>
              <BarChart data={topApps} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  width={140}
                />
                <Tooltip
                  formatter={(v: number) => [`${fmt(v)} ★`, "Consumido"]}
                />
                <Bar dataKey="total" fill="#7C3AED" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
