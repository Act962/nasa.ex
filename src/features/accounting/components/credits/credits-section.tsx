"use client";

import { RefreshCw } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreditSummary, useReprocessCredits } from "@/features/accounting/hooks/use-accounting-credits";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { CreditsIntro } from "./credits-intro";
import { CreditSummaryCards } from "./credit-summary-cards";
import { CreditsTable } from "./credits-table";
import { SupplierRanking } from "./supplier-ranking";
import { MissingInvoices } from "./missing-invoices";

const SUMMARY_MONTHS = 6;

/** Subaba "Créditos": IBS/CBS das notas de compra (spec 0051, item 5). */
export function CreditsSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const summaryQuery = useCreditSummary(SUMMARY_MONTHS);
  const reprocessCredits = useReprocessCredits();

  function handleReprocess() {
    reprocessCredits.mutate(
      {},
      {
        onSuccess: (result) => {
          if (result.scannedCount === 0) {
            toast.info("Nenhuma nota anexada nos últimos 6 meses. Anexe o XML das notas de compra na aba Despesa.");
            return;
          }
          toast.success(
            `${result.scannedCount} nota(s) relida(s): ${result.registeredCount} com crédito, ${result.skippedCount} sem crédito.`,
          );
        },
        onError: (error) => toast.error(error.message || "Não foi possível reprocessar as notas agora."),
      },
    );
  }

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os créditos agora. Tente de novo em instantes.</p>
          <Button size="sm" variant="outline" onClick={() => summaryQuery.refetch()}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const summary = summaryQuery.data;
  const monthOptions = [...summary.months.map((month) => month.month)].reverse();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-semibold">
            Créditos de CBS e IBS
            <FiscalTermHint termId="credito-nao-cumulativo" />
          </h2>
          <p className="text-sm text-muted-foreground">O imposto das suas compras que volta para você.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleReprocess}
            disabled={reprocessCredits.isPending}
          >
            {reprocessCredits.isPending ? <OrbitaSpinner className="size-3.5 " /> : <RefreshCw className="size-3.5" />}
            Reprocessar notas
          </Button>
          {onNavigate && (
            <Button size="sm" variant="ghost" onClick={() => onNavigate("assessments")}>
              Ver apurações
            </Button>
          )}
        </div>
      </div>

      <CreditsIntro isTestYear={summary.isTestYear} />

      <CreditSummaryCards
        availableCbsCents={summary.availableCbsCents}
        availableIbsCents={summary.availableIbsCents}
        currentMonth={summary.currentMonth}
        months={summary.months}
      />

      <MissingInvoices />
      <SupplierRanking />
      <CreditsTable monthOptions={monthOptions} />
    </div>
  );
}
