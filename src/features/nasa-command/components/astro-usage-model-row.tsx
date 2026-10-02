"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { formatTokens, formatUsd } from "@/features/ai-credits/lib/format-ai-credits";

/** Um modelo no "Uso do ASTRO": preço, barra da fatia do gasto e, ao expandir, o consumo dele em US$ e R$ (spec 0055, RF-14). */

export interface ModelUsageView {
  tokensToday: number;
  tokens30d: number;
  costUsdToday: number;
  costUsd30d: number;
  ownKeyCostUsdSinceReference: number;
}

/** De onde vem o dinheiro deste modelo: crédito informado da chave própria, Stars (chave da ÓRBITA) ou ainda sem saldo informado. */
export type ModelCreditBasis =
  | { kind: "own-credit"; referenceUsd: number; referenceStartAt: string }
  | { kind: "stars" }
  | { kind: "no-credit" };

function formatPercent(percent: number): string {
  if (percent > 0 && percent < 0.1) return "<0,1%";
  return `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function toneColor(percent: number): string {
  if (percent >= 90) return "var(--destructive)";
  if (percent >= 75) return "var(--temp-hot)";
  if (percent >= 50) return "var(--warning)";
  return "var(--info)";
}

function formatBrl(amountBrl: number): string {
  return amountBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function UsagePeriodLine({ label, tokens, costUsd, usdToBrlRate }: { label: string; tokens: number; costUsd: number; usdToBrlRate: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {formatTokens(tokens)} tokens · {formatUsd(costUsd, 4)} · {formatBrl(costUsd * usdToBrlRate)}
      </span>
    </div>
  );
}

export function AstroUsageModelRow({
  modelId,
  priceLabel,
  isActive,
  isVoice,
  usage,
  creditBasis,
  usdToBrlRate,
  isEnabled,
  onToggle,
}: {
  modelId: string;
  priceLabel: string;
  isActive: boolean;
  isVoice: boolean;
  usage: ModelUsageView | undefined;
  /** A barra compara o gasto deste modelo com o crédito informado da IA (spec 0055, RF-17). */
  creditBasis: ModelCreditBasis;
  usdToBrlRate: number;
  /** Modelo ligado para o ASTRO (spec 0055, RF-16). */
  isEnabled: boolean;
  onToggle: (isEnabled: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const creditPercent =
    creditBasis.kind === "own-credit" && creditBasis.referenceUsd > 0
      ? ((usage?.ownKeyCostUsdSinceReference ?? 0) / creditBasis.referenceUsd) * 100
      : null;

  return (
    <li className={cn("space-y-1 transition-opacity", !isEnabled && "opacity-55")}>
      <div className="flex items-center gap-2">
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggle}
          aria-label={`${isEnabled ? "Desligar" : "Ligar"} ${modelId}`}
          className="scale-75"
        />
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-xs"
        >
          <span className="flex min-w-0 items-center gap-1">
            <ChevronDownIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !isExpanded && "-rotate-90")} />
            <span className={cn("truncate font-mono text-[11.5px]", isActive && isEnabled && "text-info")}>{modelId}</span>
            {isVoice && <span className="shrink-0 font-sans text-[10.5px] text-muted-foreground">voz</span>}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{priceLabel}</span>
        </button>
      </div>
      {creditPercent !== null ? (
        <div className="ml-[52px] flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-knob">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${Math.min(100, Math.max(creditPercent > 0 ? 1 : 0, creditPercent))}%`, background: toneColor(creditPercent) }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground" title="Gasto deste modelo sobre o crédito informado">
            {formatPercent(creditPercent)}
          </span>
        </div>
      ) : (
        <p className="ml-[52px] text-[10.5px] text-muted-foreground">
          {creditBasis.kind === "stars" ? "pago em Stars" : "informe o saldo para ver o % gasto"}
        </p>
      )}
      {isExpanded && (
        <div className="ml-[52px] space-y-1 rounded-[12px] bg-background/40 px-2.5 py-2">
          <UsagePeriodLine label="Hoje" tokens={usage?.tokensToday ?? 0} costUsd={usage?.costUsdToday ?? 0} usdToBrlRate={usdToBrlRate} />
          <UsagePeriodLine label="30 dias" tokens={usage?.tokens30d ?? 0} costUsd={usage?.costUsd30d ?? 0} usdToBrlRate={usdToBrlRate} />
          <p className="text-[10.5px] text-muted-foreground">
            {creditBasis.kind === "own-credit"
              ? `${formatPercent(creditPercent ?? 0)} do crédito informado (${formatUsd(creditBasis.referenceUsd)}) desde ${new Date(creditBasis.referenceStartAt).toLocaleDateString("pt-BR")} · ${formatUsd(usage?.ownKeyCostUsdSinceReference ?? 0, 4)} gastos`
              : creditBasis.kind === "stars"
                ? "Pago em Stars (chave da ÓRBITA): sem crédito seu para comparar"
                : "Informe o saldo desta IA para ver a barra contra o seu crédito"}{" "}
            · câmbio US$ 1 = {formatBrl(usdToBrlRate)} · atualiza a cada 15 s
          </p>
        </div>
      )}
    </li>
  );
}
