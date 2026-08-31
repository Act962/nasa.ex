"use client";

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";
import { usePaymentProjection, type ProjectionHorizon } from "../../hooks/use-payment-projection";
import { formatCurrency, formatAxisCurrency } from "../../lib/format";
import { cn } from "@/lib/utils";

const HORIZON_OPTIONS: ProjectionHorizon[] = [3, 6, 12];

function confidenceLabel(confidence: number, hasTrendBasis: boolean): string {
  if (!hasTrendBasis) return "sem base histórica";
  if (confidence >= 0.99) return "tudo contratado";
  if (confidence >= 0.6) return "majoritariamente contratado";
  if (confidence >= 0.3) return "parcialmente estimado";
  return "majoritariamente estimado";
}

function confidenceClasses(confidence: number, hasTrendBasis: boolean): string {
  if (!hasTrendBasis) return "border-border bg-muted text-muted-foreground";
  if (confidence >= 0.6)
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (confidence >= 0.3)
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400";
}

export function ProjectionTab() {
  const [horizonMonths, setHorizonMonths] = useState<ProjectionHorizon>(6);
  const { data, isLoading } = usePaymentProjection({ horizonMonths });

  const months = data?.months ?? [];
  const openingBalance = data?.openingBalance ?? 0;
  const hasTrendBasis = data?.hasTrendBasis ?? false;

  const finalBalance = months[months.length - 1]?.projectedBalance ?? openingBalance;
  const lowestMonth = months.reduce<(typeof months)[number] | null>(
    (lowest, month) =>
      !lowest || month.projectedBalance < lowest.projectedBalance ? month : lowest,
    null,
  );
  const hasNegativeMonth = !!lowestMonth && lowestMonth.projectedBalance < 0;
  const totalOverdue = (data?.overdueIn ?? 0) + (data?.overdueOut ?? 0);

  const chartData = months.map((month) => ({
    mes: month.label,
    Contratado: (month.committedIn - month.committedOut) / 100,
    Estimado: (month.estimatedIn - month.estimatedOut) / 100,
    "Saldo projetado": month.projectedBalance / 100,
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted/40" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-lg bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projeção financeira</h2>
          <p className="text-sm text-muted-foreground">
            Quanto você espera ter em caixa, mês a mês. O contratado vem dos
            lançamentos; o estimado, da média dos últimos meses.
          </p>
        </div>

        <div className="flex gap-1 rounded-md border p-1">
          {HORIZON_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setHorizonMonths(option)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                horizonMonths === option
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {option} meses
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Wallet className="size-4" />
              <span className="text-xs font-medium">Saldo hoje</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(openingBalance)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {data?.accountsCount === 0
                ? "Nenhuma conta bancária ativa cadastrada"
                : `Soma de ${data?.accountsCount} ${data?.accountsCount === 1 ? "conta ativa" : "contas ativas"}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              {finalBalance >= openingBalance ? (
                <TrendingUp className="size-4 text-emerald-500" />
              ) : (
                <TrendingDown className="size-4 text-red-500" />
              )}
              <span className="text-xs font-medium">
                Saldo em {months[months.length - 1]?.label ?? "—"}
              </span>
            </div>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                finalBalance < 0 && "text-red-500",
              )}
            >
              {formatCurrency(finalBalance)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {finalBalance >= openingBalance ? "+" : ""}
              {formatCurrency(finalBalance - openingBalance)} no período
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(hasNegativeMonth && "border-red-500/40 bg-red-500/5")}
        >
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <AlertTriangle
                className={cn("size-4", hasNegativeMonth && "text-red-500")}
              />
              <span className="text-xs font-medium">Menor saldo do período</span>
            </div>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                hasNegativeMonth && "text-red-500",
              )}
            >
              {formatCurrency(lowestMonth?.projectedBalance ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {hasNegativeMonth
                ? `Caixa negativo em ${lowestMonth?.label}`
                : `Em ${lowestMonth?.label ?? "—"} — sem caixa negativo`}
            </p>
          </CardContent>
        </Card>
      </div>

      {(!hasTrendBasis || totalOverdue > 0 || data?.accountsCount === 0) && (
        <div className="space-y-2">
          {data?.accountsCount === 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p>
                Nenhuma conta bancária ativa cadastrada, então a projeção parte
                de zero e mostra só o resultado do período. Cadastre as contas na
                aba <strong>Contas</strong> para ver o caixa real.
              </p>
            </div>
          )}

          {!hasTrendBasis && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                Sem histórico suficiente para estimar tendência — são precisos ao
                menos 2 meses fechados com movimento. A projeção mostra apenas o
                que já está lançado.
              </p>
            </div>
          )}

          {totalOverdue > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-xs">
              <Clock className="mt-0.5 size-4 shrink-0 text-orange-500" />
              <p>
                <strong>{formatCurrency(totalOverdue)}</strong> em lançamentos
                vencidos e ainda em aberto foram somados ao primeiro mês
                {(data?.overdueOut ?? 0) > 0 && (data?.overdueIn ?? 0) > 0
                  ? ` (${formatCurrency(data?.overdueIn ?? 0)} a receber, ${formatCurrency(data?.overdueOut ?? 0)} a pagar)`
                  : ""}
                . É a razão de ele destoar dos demais.
              </p>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Saldo projetado e movimento por mês
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-0">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatAxisCurrency(value * 100)}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(Math.round(value * 100))}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} className="stroke-border" />
                <Bar dataKey="Contratado" stackId="mov" fill="#1E90FF" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Estimado" stackId="mov" fill="#1E90FF" fillOpacity={0.35} />
                <Line
                  type="monotone"
                  dataKey="Saldo projetado"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">Saldo projetado</TableHead>
                  <TableHead>Confiança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month) => {
                  const totalIn = month.committedIn + month.estimatedIn;
                  const totalOut = month.committedOut + month.estimatedOut;
                  const result = totalIn - totalOut;
                  const isNegative = month.projectedBalance < 0;

                  return (
                    <TableRow
                      key={month.month}
                      className={cn(isNegative && "bg-red-500/5")}
                    >
                      <TableCell className="font-medium">
                        {month.label}
                        {isNegative && (
                          <AlertTriangle className="ml-1.5 inline size-3.5 text-red-500" />
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(totalIn)}
                        </span>
                        {month.estimatedIn > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({formatCurrency(month.estimatedIn)} est.)
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        <span className="text-red-500">{formatCurrency(totalOut)}</span>
                        {month.estimatedOut > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({formatCurrency(month.estimatedOut)} est.)
                          </span>
                        )}
                      </TableCell>

                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          result >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
                        )}
                      >
                        {result >= 0 ? "+" : ""}
                        {formatCurrency(result)}
                      </TableCell>

                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          isNegative && "text-red-500",
                        )}
                      >
                        {formatCurrency(month.projectedBalance)}
                      </TableCell>

                      <TableCell>
                        <UiTooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={cn(
                                "cursor-default text-[10px]",
                                confidenceClasses(month.confidence, hasTrendBasis),
                              )}
                            >
                              {hasTrendBasis
                                ? `${Math.round(month.confidence * 100)}%`
                                : "—"}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {confidenceLabel(month.confidence, hasTrendBasis)}
                          </TooltipContent>
                        </UiTooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasTrendBasis && (
            <p className="px-6 pt-3 text-[11px] text-muted-foreground">
              Estimativa baseada na média de {data?.trendMonthsUsed} meses
              fechados: {formatCurrency(data?.monthlyAverageIn ?? 0)} de entrada e{" "}
              {formatCurrency(data?.monthlyAverageOut ?? 0)} de saída por mês. No
              mês corrente ela é proporcional ao que resta do mês.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
