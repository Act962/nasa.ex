"use client";

import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePricingDiagnostics } from "@/features/accounting/hooks/use-accounting-pricing";
import {
  APPLY_PRICE_EVENT,
  consumePendingApplyPrice,
  type ApplyPriceEventDetail,
} from "../calculator/apply-price-event";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { PricingIntro } from "./pricing-intro";
import { EffectiveRateCard } from "./effective-rate-card";
import { ProductsPricingTable } from "./products-pricing-table";
import { ProposalsTaxReview } from "./proposals-tax-review";
import { OtherPricesCard } from "./other-prices-card";
import { ClassificationManager } from "./classification-manager";
import { ApplyPricePanel } from "./apply-price-panel";

function isApplyPriceDetail(value: unknown): value is ApplyPriceEventDetail {
  if (!value || typeof value !== "object") return false;
  const { priceCents, taxRateBps } = value as { priceCents?: unknown; taxRateBps?: unknown };
  return typeof priceCents === "number" && priceCents > 0 && typeof taxRateBps === "number";
}

/** Subaba "Produtos & Preços" (spec 0051, item 7). */
export function PricingSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const diagnosticsQuery = usePricingDiagnostics();
  const [priceSuggestion, setPriceSuggestion] = useState<ApplyPriceEventDetail | null>(null);

  // A calculadora costuma disparar o evento antes de esta seção montar: lê o pendente e segue ouvindo.
  useEffect(() => {
    const pendingSuggestion = consumePendingApplyPrice();
    if (pendingSuggestion) setPriceSuggestion(pendingSuggestion);

    function handleApplyPrice(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      consumePendingApplyPrice();
      if (isApplyPriceDetail(detail)) setPriceSuggestion(detail);
    }
    window.addEventListener(APPLY_PRICE_EVENT, handleApplyPrice);
    return () => window.removeEventListener(APPLY_PRICE_EVENT, handleApplyPrice);
  }, []);

  const diagnostics = diagnosticsQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-semibold">
            Produtos & Preços
            <FiscalTermHint termId="aliquota-efetiva" />
          </h2>
          <p className="text-sm text-muted-foreground">Quanto do seu preço vira imposto — e se as propostas já contam com isso.</p>
        </div>
        {onNavigate && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate("calculator")}>
            <Calculator className="size-3.5" />
            Calcular preço com markup
          </Button>
        )}
      </div>

      {priceSuggestion && (
        <ApplyPricePanel
          suggestion={priceSuggestion}
          products={(diagnostics?.products ?? []).map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            priceCents: product.priceCents,
          }))}
          onDismiss={() => setPriceSuggestion(null)}
        />
      )}

      <PricingIntro />
      <EffectiveRateCard />

      {diagnosticsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : diagnosticsQuery.isError || !diagnostics ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-muted-foreground">
              Não foi possível analisar seus produtos e propostas agora. Tente de novo em instantes.
            </p>
            <Button size="sm" variant="outline" onClick={() => diagnosticsQuery.refetch()}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <ProductsPricingTable products={diagnostics.products} />
          <ProposalsTaxReview proposals={diagnostics.proposals} />
          <OtherPricesCard
            serviceRateBps={diagnostics.serviceRateBps}
            courses={diagnostics.courses}
            trafegoPlans={diagnostics.trafegoPlans}
          />
        </>
      )}

      <ClassificationManager />
    </div>
  );
}
