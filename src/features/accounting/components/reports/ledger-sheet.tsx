"use client";

import { BookText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLedger } from "@/features/accounting/hooks/use-accounting-ledger";
import { formatCentsBrl } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { formatIsoDate, formatJournalDate, type ReportPeriod } from "./report-period";

interface LedgerSheetProps {
  accountId: string | null;
  period: ReportPeriod;
  onClose: () => void;
}

/** Razão de uma conta: cada movimento do período com o saldo acumulado. */
export function LedgerSheet({ accountId, period, onClose }: LedgerSheetProps) {
  const ledger = useLedger({ accountId, from: period.from, to: period.to });
  const ledgerData = ledger.data;

  return (
    <Sheet open={accountId !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookText className="size-4 text-violet-600" />
            Razão
            <FiscalTermHint termId="razao" />
          </SheetTitle>
          <SheetDescription>
            {ledgerData ? `${ledgerData.account.code} · ${ledgerData.account.name}` : "Movimentos da conta"} —{" "}
            {formatIsoDate(period.from)} a {formatIsoDate(period.to)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-6">
          {ledger.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          )}

          {ledger.isError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Não foi possível abrir o razão desta conta.
            </p>
          )}

          {ledgerData && (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Saldo anterior</p>
                  <p className="font-semibold tabular-nums">{formatCentsBrl(ledgerData.openingCents)}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Saldo final</p>
                  <p className="font-semibold tabular-nums">{formatCentsBrl(ledgerData.closingCents)}</p>
                </div>
              </div>

              {ledgerData.movements.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum movimento nesta conta no período.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-[560px] text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Histórico</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerData.movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="whitespace-nowrap">{formatJournalDate(movement.date)}</TableCell>
                          <TableCell className="min-w-48 whitespace-normal">{movement.description}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {movement.debitCents ? formatCentsBrl(movement.debitCents) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {movement.creditCents ? formatCentsBrl(movement.creditCents) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatCentsBrl(movement.balanceCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="font-semibold">
                          Saldo final
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCentsBrl(ledgerData.closingCents)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
