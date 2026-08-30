"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useOperationalResult,
  type ReportRegime,
} from "../../hooks/use-payment-reports";
import { formatCurrency, formatPercent } from "../../lib/format";
import {
  currentMonthRange,
  type PeriodRange,
} from "../shared/payment-period-picker";
import { ReportToolbar } from "./report-toolbar";

function resultClass(value: number) {
  return value >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

function TotalCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 truncate text-xl font-bold tabular-nums", className)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function DroTab() {
  const [period, setPeriod] = useState<PeriodRange>(currentMonthRange());
  const [regime, setRegime] = useState<ReportRegime>("cash");

  const { data, isLoading } = useOperationalResult({
    dateFrom: period.from?.toISOString(),
    dateTo: period.to?.toISOString(),
    regime,
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <ReportToolbar
        title="DRO"
        subtitle="Demonstração do Resultado Operacional por centro de custo"
        period={period}
        onPeriodChange={setPeriod}
        regime={regime}
        onRegimeChange={setRegime}
      />

      {isLoading || !data ? (
        <div className="h-72 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <TotalCard
              label="Receita"
              value={formatCurrency(data.totals.revenue)}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <TotalCard
              label="Despesa"
              value={formatCurrency(data.totals.expenses)}
              className="text-red-600 dark:text-red-400"
            />
            <TotalCard
              label="Resultado"
              value={formatCurrency(data.totals.result)}
              className={resultClass(data.totals.result)}
            />
            <TotalCard
              label="Margem"
              value={formatPercent(data.totals.marginPercent)}
              className={resultClass(data.totals.result)}
            />
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border py-14 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                <Building2 className="size-5 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">
                Nenhum movimento no período selecionado.
              </p>
            </div>
          ) : (
            <>
              {/* Cards — mobile */}
              <div className="space-y-2 md:hidden">
                {rows.map((row) => (
                  <div
                    key={row.costCenterId ?? "none"}
                    className="rounded-xl border border-border/50 bg-card p-3"
                  >
                    <p className="truncate text-sm font-medium">
                      {row.costCenterName}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Receita</p>
                        <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(row.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Despesa</p>
                        <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                          {formatCurrency(row.expenses)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Resultado</p>
                        <p
                          className={cn(
                            "font-semibold tabular-nums",
                            resultClass(row.result),
                          )}
                        >
                          {formatCurrency(row.result)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabela — desktop */}
              <div className="hidden overflow-hidden rounded-xl border border-border/50 md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">
                          Centro de custo
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Receita
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Despesa
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Resultado
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Margem
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.costCenterId ?? "none"}
                          className="border-b border-border/30 hover:bg-muted/20"
                        >
                          <td className="px-4 py-3 font-medium">
                            {row.costCenterName}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(row.revenue)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                            {formatCurrency(row.expenses)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-right font-semibold tabular-nums",
                              resultClass(row.result),
                            )}
                          >
                            {formatCurrency(row.result)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatPercent(row.marginPercent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 font-semibold">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(data.totals.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(data.totals.expenses)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right tabular-nums",
                            resultClass(data.totals.result),
                          )}
                        >
                          {formatCurrency(data.totals.result)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPercent(data.totals.marginPercent)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
