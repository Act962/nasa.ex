"use client";

import { useState } from "react";
import { AlertTriangle, BarChart3, Radio, RefreshCw } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTrafegoOrderAds, useTrafegoOrderBudget } from "@/features/trafego/hooks/use-trafego-performance";
import { useCampaignBuilderAccess } from "@/features/trafego/hooks/use-trafego-campaign-builder";
import type { PerformanceRange } from "@/features/trafego/lib/order-meta-metrics";
import { TechnicalTerm } from "../../technical-term";
import { formatMoneyFromCents } from "../account-performance-sections";
import { ServiceFeeSection } from "../service-fee-section";
import { MetricsGrid } from "./ad-metrics";
import { AdsList } from "./ads-list";

/** A campanha de cara: verba, números somados e cada anúncio (spec 0126, RF-1/RF-2). */

const RANGE_OPTIONS: { key: PerformanceRange; label: string }[] = [
  { key: "order", label: "Desde o início" },
  { key: "last_7d", label: "7 dias" },
  { key: "last_30d", label: "30 dias" },
];

export function CampaignOverview({
  orderId,
  orderCode,
  onSupport,
}: {
  orderId: string;
  orderCode: string;
  onSupport: () => void;
}) {
  const [range, setRange] = useState<PerformanceRange>("order");
  const adsQuery = useTrafegoOrderAds(orderId, range);
  const { data: budgetResult } = useTrafegoOrderBudget(orderId);
  const { data: builderAccess } = useCampaignBuilderAccess(orderId);
  const result = adsQuery.data;

  if (adsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        Lendo a conta de anúncios…
      </div>
    );
  }

  // Falha de rede ou da Meta nunca vira "carregando para sempre" (CB-5).
  if (adsQuery.isError || !result || result.mode === "unavailable") {
    const message =
      result?.mode === "unavailable" ? result.message : "Não conseguimos ler a conta de anúncios agora.";
    const isTokenProblem = result?.mode === "unavailable" && result.reason === "token_invalid";
    return (
      <div className="rounded-[20px] border border-warning/40 bg-warning/10 p-4">
        <p className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          {message}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => adsQuery.refetch()}>
            <RefreshCw className="size-3.5" />
            Tentar de novo
          </Button>
          {isTokenProblem && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={onSupport}>
              Avisar o suporte
            </Button>
          )}
        </div>
      </div>
    );
  }
  if (result.mode !== "account") return null;

  const currency = result.currency;
  const budget = budgetResult?.mode === "account" ? budgetResult.budget : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Radio className="size-3.5 text-success" />
          Atualizado às{" "}
          {new Date(result.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className={cn(
                "min-h-8 rounded-full px-3 text-xs transition",
                range === option.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {budget && (
        <div className="rounded-[20px] border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex items-center text-sm font-medium">
              Verba da campanha
              <TechnicalTerm term="adBudget" />
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatMoneyFromCents(budget.spentBrlCents, currency)} de{" "}
              {formatMoneyFromCents(budget.adBudgetBrlCents, "BRL")}
            </p>
          </div>
          {budget.percentUsed === null ? (
            <p className="mt-2 text-xs text-warning">
              A conta não é em reais ({currency}): a comparação com a verba fica de fora.
            </p>
          ) : (
            <>
              <Progress value={budget.percentUsed} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                Restam {formatMoneyFromCents(budget.remainingBrlCents, "BRL")} da verba destinada.
              </p>
            </>
          )}
        </div>
      )}

      {result.ads.length === 0 ? (
        <div className="rounded-[22px] border border-dashed px-6 py-8 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <BarChart3 className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">Nenhum anúncio desta campanha na conta ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Aparecem aqui os anúncios das campanhas com {orderCode} no nome.
          </p>
        </div>
      ) : (
        <>
          <MetricsGrid metrics={result.totals} currency={currency} />
          {result.averages && (
            <p className="text-[11px] text-muted-foreground">
              Setas: acima ou abaixo da média dos anúncios do mesmo objetivo na sua conta. Verde é bom, vermelho pede
              atenção{result.isQualityScoreVisible ? " — clique nas vermelhas para ver o que melhorar" : ""}.
            </p>
          )}
          {result.totals.spendCents === 0 && (
            <p className="text-xs text-muted-foreground">Sem entrega no período escolhido.</p>
          )}
          <AdsList
            orderId={orderId}
            ads={result.ads}
            currency={currency}
            canFix={builderAccess?.canBuild === true}
            isQualityScoreVisible={result.isQualityScoreVisible}
          />
          {result.isTruncated && (
            <p className="text-xs text-muted-foreground">Mostrando os primeiros anúncios da conta.</p>
          )}
        </>
      )}

      <ServiceFeeSection orderId={orderId} />
    </div>
  );
}
