"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Inbox, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTrialBalance } from "@/features/accounting/hooks/use-accounting-ledger";
import { formatCentsBrl } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { accountDepth, compareAccountCodes } from "../chart/account-code";
import { downloadTrialBalanceCsv } from "./export-trial-balance-csv";
import type { ReportPeriod } from "./report-period";

const INDENT_PER_LEVEL_PX = 12;

interface TrialBalanceViewProps {
  period: ReportPeriod;
  onOpenLedger: (accountId: string) => void;
  onRequestReprocess: () => void;
}

function formatCell(cents: number): string {
  return cents === 0 ? "—" : formatCentsBrl(cents);
}

/** Balancete de verificação do período. */
export function TrialBalanceView({ period, onOpenLedger, onRequestReprocess }: TrialBalanceViewProps) {
  const trialBalance = useTrialBalance(period);
  const [shouldHideZeroRows, setShouldHideZeroRows] = useState(true);

  const sortedRows = useMemo(
    () => [...(trialBalance.data?.rows ?? [])].sort((first, second) => compareAccountCodes(first.code, second.code)),
    [trialBalance.data],
  );
  const hasAnyMovement = sortedRows.some((row) => row.openingCents !== 0 || row.debitCents !== 0 || row.creditCents !== 0);
  const visibleRows = shouldHideZeroRows
    ? sortedRows.filter((row) => row.openingCents !== 0 || row.debitCents !== 0 || row.creditCents !== 0 || row.closingCents !== 0)
    : sortedRows;

  if (trialBalance.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (trialBalance.isError || !trialBalance.data) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Não foi possível carregar o balancete.
        <Button type="button" size="sm" variant="outline" onClick={() => trialBalance.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (!hasAnyMovement) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Ainda não há lançamentos contabilizados — eles aparecem sozinhos conforme você usa Receita e Despesa.
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Se você já tem lançamentos pagos no financeiro e nada aparece, reprocesse a contabilidade.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onRequestReprocess}>
          Reprocessar contabilidade
        </Button>
      </div>
    );
  }

  const { totalDebitCents, totalCreditCents, isBalanced } = trialBalance.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Balancete
          <FiscalTermHint termId="balancete" />
          <span className="hidden sm:inline">· toque numa conta para ver o razão</span>
        </p>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-2">
            <Switch id="hide-zero-rows" checked={shouldHideZeroRows} onCheckedChange={setShouldHideZeroRows} />
            <Label htmlFor="hide-zero-rows" className="text-xs text-muted-foreground">
              Esconder zeradas
            </Label>
          </div>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => downloadTrialBalanceCsv(visibleRows, period)}>
            <Download className="size-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[680px] text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Saldo anterior</TableHead>
              <TableHead className="text-right">Débitos</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
              <TableHead className="text-right">Saldo final</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow
                key={row.accountId}
                className={cn(!row.isAnalytical && "bg-muted/30 font-semibold", row.isAnalytical && "cursor-pointer")}
                onClick={row.isAnalytical ? () => onOpenLedger(row.accountId) : undefined}
                tabIndex={row.isAnalytical ? 0 : undefined}
                onKeyDown={
                  row.isAnalytical
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") onOpenLedger(row.accountId);
                      }
                    : undefined
                }
              >
                <TableCell style={{ paddingLeft: 8 + accountDepth(row.code) * INDENT_PER_LEVEL_PX }} className="whitespace-normal">
                  <span className="mr-2 font-mono text-muted-foreground">{row.code}</span>
                  <span className={cn(row.isAnalytical && "text-[#1E90FF] hover:underline")}>{row.name}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCell(row.openingCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCell(row.debitCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCell(row.creditCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCell(row.closingCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Totais do período
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatCentsBrl(totalDebitCents)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatCentsBrl(totalCreditCents)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {isBalanced ? (
        <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-3.5" />
          Débitos = Créditos ✓
        </Badge>
      ) : (
        <p className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Débitos e créditos não bateram neste período (diferença de {formatCentsBrl(Math.abs(totalDebitCents - totalCreditCents))}).
          Reprocesse a contabilidade; se continuar, fale com o suporte.
        </p>
      )}
    </div>
  );
}
