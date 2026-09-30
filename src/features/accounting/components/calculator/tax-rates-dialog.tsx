"use client";

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccountingTaxRates } from "@/features/accounting/hooks/use-accounting-calculator";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";

const ALL_TAXES = "__all__";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatTaxCode(tax: string): string {
  return tax.replace(/_/g, "-");
}

interface TaxRatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Tabelas de alíquotas que as calculadoras e apurações usam, com base legal. */
export function TaxRatesDialog({ open, onOpenChange }: TaxRatesDialogProps) {
  const [selectedTax, setSelectedTax] = useState(ALL_TAXES);
  const taxRates = useAccountingTaxRates({ enabled: open });
  const rates = useMemo(() => taxRates.data?.rates ?? [], [taxRates.data]);
  const taxOptions = useMemo(() => Array.from(new Set(rates.map((rate) => rate.tax))), [rates]);
  const visibleRates = selectedTax === ALL_TAXES ? rates : rates.filter((rate) => rate.tax === selectedTax);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tabelas de alíquotas</DialogTitle>
          <DialogDescription>
            São estas tabelas que as calculadoras e as apurações usam. Linhas com “confirmar na fonte” são estimativas até
            a regulamentação ser publicada — confira no link da base legal antes de pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Select value={selectedTax} onValueChange={setSelectedTax}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Tributo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAXES}>Todos os tributos</SelectItem>
              {taxOptions.map((tax) => (
                <SelectItem key={tax} value={tax}>
                  {formatTaxCode(tax)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {taxRates.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        )}

        {taxRates.isError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Não foi possível carregar as tabelas agora. Tente de novo em instantes.
          </p>
        )}

        {!taxRates.isLoading && !taxRates.isError && visibleRates.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma alíquota cadastrada para esse filtro.</p>
        )}

        {visibleRates.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Tributo</TableHead>
                  <TableHead>Regime</TableHead>
                  <TableHead>Anexo</TableHead>
                  <TableHead className="text-right">Faixa</TableHead>
                  <TableHead className="text-right">Até R$</TableHead>
                  <TableHead className="text-right">Alíquota</TableHead>
                  <TableHead className="text-right">Dedução</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Base legal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{formatTaxCode(rate.tax)}</TableCell>
                    <TableCell>{rate.regime ?? "—"}</TableCell>
                    <TableCell>{rate.annex ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{rate.bracket ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rate.revenueToCents !== null ? formatCentsBrl(rate.revenueToCents) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rate.fixedAmountCents !== null ? `${formatCentsBrl(rate.fixedAmountCents)} fixo` : formatBps(rate.rateBps)}
                      {rate.reductionBps ? <span className="block text-muted-foreground">redução {formatBps(rate.reductionBps)}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rate.deductionCents !== null ? formatCentsBrl(rate.deductionCents) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(rate.validFrom)}
                      {rate.validTo ? ` a ${formatDate(rate.validTo)}` : " em diante"}
                    </TableCell>
                    <TableCell className="min-w-48">
                      <span className="block">{rate.legalSource}</span>
                      {rate.note && <span className="block text-muted-foreground">{rate.note}</span>}
                      {rate.needsVerification && (
                        <Badge variant="outline" className="mt-1 gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                          <TriangleAlert className="size-3" />
                          confirmar na fonte
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
