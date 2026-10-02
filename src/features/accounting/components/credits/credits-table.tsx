"use client";

import { useState } from "react";
import { FileStack } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCreditList } from "@/features/accounting/hooks/use-accounting-credits";
import { formatCentsBrl } from "@/features/accounting/lib/format";
import { formatPeriodLabel } from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import {
  CREDIT_STATUS_LABELS,
  CREDIT_STATUS_TONES,
  PAYABLES_TAB_HREF,
  formatDocument,
  type CreditStatusDisplay,
} from "./credit-display";

const ALL_STATUSES = "ALL";
const STATUS_OPTIONS = Object.keys(CREDIT_STATUS_LABELS) as CreditStatusDisplay[];

/** Tabela de créditos por nota, com filtro de situação e mês. */
export function CreditsTable({ monthOptions }: { monthOptions: string[] }) {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [monthFilter, setMonthFilter] = useState<string>(ALL_STATUSES);
  const creditsQuery = useCreditList({
    status: statusFilter === ALL_STATUSES ? undefined : (statusFilter as CreditStatusDisplay),
    month: monthFilter === ALL_STATUSES ? undefined : monthFilter,
  });
  const credits = creditsQuery.data?.credits ?? [];

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-1.5 text-base">
          Créditos por nota
          <FiscalTermHint termId="credito-nao-cumulativo" />
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[190px]" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>Todas as situações</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {CREDIT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-8 w-[150px]" aria-label="Filtrar por mês">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>Todos os meses</SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatPeriodLabel(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {creditsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : creditsQuery.isError ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar os créditos agora.</p>
        ) : credits.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            <FileStack className="size-5 text-info" />
            <p>
              Nenhum crédito por aqui ainda. Anexe o XML (ou o PDF lido pelo ASTRO) das notas de compra nos lançamentos
              de Despesa — o crédito de CBS/IBS aparece sozinho.
            </p>
            <Button asChild size="sm" variant="outline">
              <a href={PAYABLES_TAB_HREF}>Ir para Despesa</a>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Fornecedor</th>
                  <th className="px-3 py-2 text-left font-medium">Tributo</th>
                  <th className="px-3 py-2 text-left font-medium">Mês</th>
                  <th className="px-3 py-2 text-right font-medium">Crédito</th>
                  <th className="px-3 py-2 text-left font-medium">Situação</th>
                  <th className="py-2 pl-3 text-left font-medium">Lançamento</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {credits.map((credit) => (
                  <tr key={credit.id}>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{credit.supplierName ?? "Fornecedor não identificado"}</p>
                      <p className="text-xs text-muted-foreground">{formatDocument(credit.supplierDocument)}</p>
                    </td>
                    <td className="px-3 py-2">{credit.tax}</td>
                    <td className="px-3 py-2 capitalize">{formatPeriodLabel(credit.competence)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCentsBrl(credit.amountCents)}
                      {credit.invoiceTotalCents ? (
                        <p className="text-[11px] font-normal text-muted-foreground">
                          nota de {formatCentsBrl(credit.invoiceTotalCents)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn("font-normal", CREDIT_STATUS_TONES[credit.status])}>
                        {CREDIT_STATUS_LABELS[credit.status]}
                      </Badge>
                    </td>
                    <td className="py-2 pl-3 text-xs">
                      {credit.entryId ? (
                        <a href={PAYABLES_TAB_HREF} className="text-info hover:underline">
                          {credit.entryDescription ?? "Ver despesa"}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Nota ainda sem lançamento</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
