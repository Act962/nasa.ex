"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBalanceSheet } from "@/features/accounting/hooks/use-accounting-ledger";
import { formatCentsBrl } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { accountDepth, compareAccountCodes } from "../chart/account-code";
import { formatIsoDate } from "./report-period";

const INDENT_PER_LEVEL_PX = 12;

interface BalanceRow {
  code: string;
  name: string;
  amountCents: number;
}

function BalanceBlock({ title, rows, totalCents }: { title: string; rows: BalanceRow[]; totalCents: number }) {
  const sortedRows = [...rows].filter((row) => row.amountCents !== 0).sort((first, second) => compareAccountCodes(first.code, second.code));
  const minimumDepth = sortedRows.reduce((depth, row) => Math.min(depth, accountDepth(row.code)), Number.POSITIVE_INFINITY);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {sortedRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem saldo.</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {sortedRows.map((row) => {
            const relativeDepth = accountDepth(row.code) - minimumDepth;
            return (
              <li
                key={row.code}
                className={cn("flex items-baseline justify-between gap-3", relativeDepth === 0 && "font-semibold")}
                style={{ paddingLeft: relativeDepth * INDENT_PER_LEVEL_PX }}
              >
                <span className="min-w-0 break-words">{row.name}</span>
                <span className="shrink-0 tabular-nums">{formatCentsBrl(row.amountCents)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-baseline justify-between border-t pt-1.5 text-sm font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatCentsBrl(totalCents)}</span>
      </div>
    </div>
  );
}

/** Balanço patrimonial no último dia do período. */
export function BalanceSheetView({ at }: { at: string }) {
  const balanceSheet = useBalanceSheet(at);

  if (balanceSheet.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (balanceSheet.isError || !balanceSheet.data) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Não foi possível carregar o balanço.
        <Button type="button" size="sm" variant="outline" onClick={() => balanceSheet.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const { assets, liabilities, equity, isBalanced } = balanceSheet.data;
  const periodResultCents = equity.periodResultCents;
  const isProfit = periodResultCents >= 0;

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Balanço patrimonial em {formatIsoDate(at)}
        <FiscalTermHint termId="balanco" />
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-semibold">Ativo — o que a empresa tem</p>
          <BalanceBlock title="Bens e direitos" rows={assets.rows} totalCents={assets.totalCents} />
        </div>
        <div className="space-y-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">Passivo + Patrimônio líquido — de onde veio</p>
          <BalanceBlock title="Passivo (o que deve)" rows={liabilities.rows} totalCents={liabilities.totalCents} />
          <BalanceBlock title="Patrimônio líquido (dos sócios)" rows={equity.rows} totalCents={equity.totalCents} />
          <div className="flex items-baseline justify-between border-t pt-2 text-sm font-bold">
            <span>Passivo + PL</span>
            <span className="tabular-nums">{formatCentsBrl(liabilities.totalCents + equity.totalCents)}</span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col gap-1 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
          isProfit ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
        )}
      >
        <div>
          <p className="text-sm font-semibold">Resultado do período</p>
          <p className="text-xs text-muted-foreground">
            Receitas menos custos e despesas ainda não distribuídos — já incluído no patrimônio líquido acima.
          </p>
        </div>
        <p className={cn("text-lg font-bold tabular-nums", isProfit ? "text-success dark:text-success" : "text-destructive dark:text-destructive")}>
          {isProfit ? "Lucro de " : "Prejuízo de "}
          {formatCentsBrl(Math.abs(periodResultCents))}
        </p>
      </div>

      {isBalanced ? (
        <Badge variant="outline" className="gap-1 border-success/40 bg-success/10 text-success dark:text-success">
          <CheckCircle2 className="size-3.5" />
          Ativo = Passivo + PL ✓ balanço fechado
        </Badge>
      ) : (
        <p className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning dark:text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          O balanço não fechou (Ativo {formatCentsBrl(assets.totalCents)} × Passivo + PL{" "}
          {formatCentsBrl(liabilities.totalCents + equity.totalCents)}). Reprocesse a contabilidade; se continuar, fale com o suporte.
        </p>
      )}
    </div>
  );
}
