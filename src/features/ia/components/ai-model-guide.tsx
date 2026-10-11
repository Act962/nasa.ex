"use client";

import {
  ARE_PRICES_VERIFIED,
  BAND_LABEL,
  EXAMPLE_REPLY_TOKENS,
  MODEL_GUIDE_BY_ID,
  USE_RECOMMENDATIONS,
  audioMinutePriceUsd,
  replyCostLabel,
  modelPrice,
} from "@/features/ia/lib/ai-model-guide";
import { FALLBACK_USD_TO_BRL, PRICES_VERIFIED_ON } from "@/features/ia/lib/token-pricing";
import { cn } from "@/lib/utils";

// Guia de modelos (spec 0093, RF-9): para cada uso, as opções lado a lado, com o porquê e o custo.

const TEXT_USES = new Set(["attendance", "flows", "astro", "documents"]);

function formatUsd(value: number | null): string {
  return value === null ? "sem preço" : `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMinutePrice(usd: number | null): string {
  if (usd === null) return "preço não cadastrado";
  return `US$ ${usd.toLocaleString("pt-BR", { minimumFractionDigits: 3 })} (${(usd * FALLBACK_USD_TO_BRL).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 })}) por minuto`;
}

type AverageTokensByUse = Partial<Record<string, { input: number; output: number; sampleCalls: number } | null>>;

export function AiModelGuide({ averageTokensByUse = {} }: { averageTokensByUse?: AverageTokensByUse }) {
  return (
    <div className="space-y-4 border-t bg-muted/20 px-5 py-4">
      <p className="text-xs text-muted-foreground">
        Orientação para escolher, não promessa de resultado.{" "}
        {ARE_PRICES_VERIFIED
          ? `Preços conferidos nas páginas dos provedores em ${PRICES_VERIFIED_ON.split("-").reverse().join("/")}; podem ter mudado depois. `
          : "Parte dos preços é estimativa da tabela interna, ainda não conferida com os provedores. "}
        O custo por resposta usa a média real da empresa nos últimos 30 dias quando há uso suficiente; senão, uma conversa de exemplo ({EXAMPLE_REPLY_TOKENS.input.toLocaleString("pt-BR")} tokens de entrada e {EXAMPLE_REPLY_TOKENS.output} de saída) e câmbio de R${" "}
        {FALLBACK_USD_TO_BRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
      </p>
      {USE_RECOMMENDATIONS.map((recommendation) => (
        <div key={recommendation.use}>
          <p className="text-sm font-semibold">{recommendation.title}</p>
          <p className="mb-2 text-xs text-muted-foreground">{recommendation.whatMatters}</p>
          <div className="grid gap-2 md:grid-cols-3">
            {recommendation.options.map((option) => {
              const guide = MODEL_GUIDE_BY_ID.get(option.modelId);
              const price = modelPrice(option.modelId);
              const isRecommended = option.band === recommendation.recommendedBand;
              return (
                <div key={option.modelId} className={cn("rounded-2xl border bg-card p-3 text-xs", isRecommended && "border-info ring-1 ring-info/40")}>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {BAND_LABEL[option.band]}
                    {isRecommended && <span className="rounded-full bg-info/15 px-1.5 py-0.5 normal-case tracking-normal text-info">recomendado</span>}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {guide?.name ?? option.modelId} <span className="font-normal text-muted-foreground">· {guide?.providerLabel}</span>
                  </p>
                  <p className="mt-1">{option.why}</p>
                  {guide && <p className="mt-1 text-muted-foreground">Limite: {guide.limit}</p>}
                  <p className="mt-2 border-t pt-2 text-muted-foreground">
                    {guide?.isBilledPerAudioMinute
                      ? `Cobrado por minuto de áudio: ${formatMinutePrice(audioMinutePriceUsd(option.modelId))}`
                      : `${formatUsd(price.inputPerMillionUsd)} entrada · ${formatUsd(price.outputPerMillionUsd)} saída, por 1 milhão de tokens`}
                  </p>
                  {TEXT_USES.has(recommendation.use) && (
                    <p className="font-medium text-foreground">
                      {replyCostLabel(option.modelId, FALLBACK_USD_TO_BRL, averageTokensByUse[recommendation.use]) ?? "—"}
                      {averageTokensByUse[recommendation.use] ? " (média real)" : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
