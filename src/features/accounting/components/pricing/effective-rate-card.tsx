"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEffectiveTaxRate } from "@/features/accounting/hooks/use-accounting-pricing";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { REGIME_LABELS, REGIME_TERM_IDS } from "@/features/accounting/lib/profile/tax-display";
import { CalculationMemo } from "../shared/calculation-memo";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

type RateKind = "SERVICE" | "PRODUCT";

const KIND_LABELS: Record<RateKind, string> = { SERVICE: "Serviço", PRODUCT: "Produto" };

/** "Sua alíquota efetiva hoje" com memória de cálculo e comparação 2027/2033. */
export function EffectiveRateCard() {
  const [selectedKind, setSelectedKind] = useState<RateKind>("SERVICE");
  const serviceRateQuery = useEffectiveTaxRate({ kind: "SERVICE" });
  const productRateQuery = useEffectiveTaxRate({ kind: "PRODUCT" });
  const selectedQuery = selectedKind === "SERVICE" ? serviceRateQuery : productRateQuery;
  const selectedRate = selectedQuery.data;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex flex-wrap items-center gap-1.5 text-base">
          Sua alíquota efetiva hoje
          <FiscalTermHint termId="aliquota-efetiva" />
        </CardTitle>
        {serviceRateQuery.data && (
          <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            Regime: {REGIME_LABELS[serviceRateQuery.data.regime]}
            <FiscalTermHint termId={REGIME_TERM_IDS[serviceRateQuery.data.regime]} />· faturamento dos últimos 12
            meses {formatCentsBrl(serviceRateQuery.data.rbt12Cents)}
            <FiscalTermHint termId="rbt12" />
            {serviceRateQuery.data.isRbt12Proportional && " (proporcional: empresa com menos de 12 meses)"}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["SERVICE", "PRODUCT"] as RateKind[]).map((kind) => {
            const rateQuery = kind === "SERVICE" ? serviceRateQuery : productRateQuery;
            const isSelected = kind === selectedKind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setSelectedKind(kind)}
                aria-pressed={isSelected}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  isSelected ? "border-violet-500 bg-violet-500/5" : "hover:bg-muted/50",
                )}
              >
                <p className="text-sm text-muted-foreground">{KIND_LABELS[kind]}</p>
                {rateQuery.isLoading ? (
                  <Skeleton className="mt-1 h-8 w-24" />
                ) : rateQuery.data ? (
                  <>
                    <p className="text-3xl font-bold tabular-nums text-violet-600 dark:text-violet-400">
                      {formatBps(rateQuery.data.rateBps)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rateQuery.data.comparison
                        .map((point) => `${point.year}: ${formatBps(point.rateBps)}${point.isEstimated ? " (estimado)" : ""}`)
                        .join(" · ")}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Indisponível agora.</p>
                )}
              </button>
            );
          })}
        </div>

        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          A partir de 2027 entram a CBS <FiscalTermHint termId="cbs" /> e, aos poucos, o IBS{" "}
          <FiscalTermHint termId="ibs" />. As alíquotas de referência ainda serão fixadas pelo Senado — por isso
          “estimado”.
        </p>

        {selectedRate && (
          <details className="rounded-lg border p-3" open>
            <summary className="cursor-pointer select-none text-sm font-medium">
              Como chegamos em {formatBps(selectedRate.rateBps)} ({KIND_LABELS[selectedKind].toLowerCase()})
            </summary>
            <div className="mt-3">
              <CalculationMemo
                title={`Alíquota efetiva — ${KIND_LABELS[selectedKind]}`}
                steps={selectedRate.steps}
                warnings={selectedRate.warnings}
                sources={selectedRate.sources}
                astroQuestion="Explique minha alíquota efetiva em linguagem simples e como ela deve entrar no meu preço de venda."
              />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
