"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCentsBrl } from "@/features/accounting/lib/format";
import { formatPeriodLabel } from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

interface CreditSummaryMonth {
  month: string;
  cbsAvailableCents: number;
  ibsAvailableCents: number;
  pendingPaymentCents: number;
  usedCents: number;
  glossedCents: number;
}

interface CreditSummaryCardsProps {
  availableCbsCents: number;
  availableIbsCents: number;
  currentMonth: string;
  months: CreditSummaryMonth[];
}

export function CreditSummaryCards({ availableCbsCents, availableIbsCents, currentMonth, months }: CreditSummaryCardsProps) {
  const currentMonthSummary = months.find((summary) => summary.month === currentMonth);
  const pendingTotalCents = months.reduce((total, summary) => total + summary.pendingPaymentCents, 0);
  const hasAnyCredit = months.some(
    (summary) =>
      summary.cbsAvailableCents + summary.ibsAvailableCents + summary.pendingPaymentCents + summary.usedCents > 0,
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              Crédito disponível
              <FiscalTermHint termId="credito-nao-cumulativo" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold tabular-nums text-success dark:text-success">
              {formatCentsBrl(availableCbsCents + availableIbsCents)}
            </p>
            <p className="text-xs text-muted-foreground">
              CBS {formatCentsBrl(availableCbsCents)} · IBS {formatCentsBrl(availableIbsCents)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Esperando você pagar a compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold tabular-nums text-warning dark:text-warning">
              {formatCentsBrl(pendingTotalCents)}
            </p>
            <p className="text-xs text-muted-foreground">Vira disponível assim que a despesa for marcada como paga.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usado em {formatPeriodLabel(currentMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold tabular-nums text-info dark:text-info">
              {formatCentsBrl(currentMonthSummary?.usedCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Abatido do imposto das suas vendas na apuração do mês.</p>
          </CardContent>
        </Card>
      </div>

      {hasAnyCredit && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mês da nota</th>
                <th className="px-3 py-2 text-right font-medium">CBS disponível</th>
                <th className="px-3 py-2 text-right font-medium">IBS disponível</th>
                <th className="px-3 py-2 text-right font-medium">Aguardando pagamento</th>
                <th className="px-3 py-2 text-right font-medium">Usado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {months.map((summary) => (
                <tr key={summary.month}>
                  <td className="px-3 py-2 capitalize">{formatPeriodLabel(summary.month)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(summary.cbsAvailableCents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(summary.ibsAvailableCents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(summary.pendingPaymentCents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(summary.usedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
