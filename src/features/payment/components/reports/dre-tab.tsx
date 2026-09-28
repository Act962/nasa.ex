"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useIncomeStatement,
  type ReportRegime,
} from "../../hooks/use-payment-reports";
import { formatCurrency, formatPercent } from "../../lib/format";
import {
  usePaymentPeriodIso,
  usePaymentCategoryFilter,
} from "../../store/use-payment-filters-store";
import { ReportToolbar } from "./report-toolbar";

type GroupLine = { name: string; amount: number };

function GroupSection({
  label,
  total,
  lines,
  sign,
}: {
  label: string;
  total: number;
  lines: GroupLine[];
  sign: "+" | "−";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <span className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide">
          {sign === "−" ? "(−) " : ""}
          {label}
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-bold tabular-nums",
            sign === "+"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
          )}
        >
          {formatCurrency(total)}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground sm:px-5">
          Nenhum lançamento no período.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {lines.map((line) => (
            <li
              key={line.name}
              className="flex items-center justify-between gap-3 px-4 py-2 sm:px-5"
            >
              <span
                className="min-w-0 truncate pl-3 text-sm text-muted-foreground"
                title={line.name}
              >
                {line.name}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatCurrency(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({
  label,
  value,
  marginPercent,
  emphasis,
}: {
  label: string;
  value: number;
  marginPercent: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3 sm:px-5",
        emphasis && "bg-muted/70",
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-semibold uppercase tracking-wide",
            emphasis && "text-base",
          )}
        >
          = {label}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Margem {formatPercent(marginPercent)}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 font-bold tabular-nums",
          emphasis ? "text-lg" : "text-sm",
          value >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function DreTab() {
  const [regime, setRegime] = useState<ReportRegime>("cash");

  const { dateFrom, dateTo } = usePaymentPeriodIso();
  const categoryIds = usePaymentCategoryFilter();

  const { data, isLoading } = useIncomeStatement({ dateFrom, dateTo, regime, categoryIds });

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <ReportToolbar
        title="DRE"
        subtitle="Demonstração do Resultado do Exercício"
        regime={regime}
        onRegimeChange={setRegime}
      />

      {isLoading || !data ? (
        <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <GroupSection
              label="Receita bruta"
              total={data.revenue.total}
              lines={data.revenue.lines}
              sign="+"
            />
            <GroupSection
              label="Custos"
              total={data.costs.total}
              lines={data.costs.lines}
              sign="−"
            />
            <ResultRow
              label="Lucro bruto"
              value={data.grossProfit}
              marginPercent={data.grossMarginPercent}
            />
            <GroupSection
              label="Despesas operacionais"
              total={data.expenses.total}
              lines={data.expenses.lines}
              sign="−"
            />
            <ResultRow
              label="Resultado líquido"
              value={data.netResult}
              marginPercent={data.netMarginPercent}
              emphasis
            />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {regime === "cash"
          ? "Regime de caixa: considera o que foi efetivamente pago ou recebido no período."
          : "Competência: considera os lançamentos pelo vencimento, pagos ou não."}{" "}
        Custos vêm das categorias do tipo Custo; despesas operacionais, das do
        tipo Despesa.
      </p>
    </div>
  );
}
