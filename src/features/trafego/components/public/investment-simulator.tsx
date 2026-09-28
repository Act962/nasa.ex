"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Check, MessageCircle, TrendingDown } from "lucide-react";
import {
  MAX_AD_BUDGET_BRL_CENTS,
  MIN_AD_BUDGET_BRL_CENTS,
  TRAFEGO_TIERS,
  quoteTrafego,
} from "@/features/trafego/lib/pricing-tiers";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { cn } from "@/lib/utils";
import { OrderSummary } from "./wizard/order-summary";

const PRESETS = [30_000, 100_000, 250_000, 500_000, 1_000_000];
const SLIDER_MAX = 1_000_000; // R$ 10.000 — acima disso, digita no campo

interface InvestmentSimulatorProps {
  adBudgetBrlCents: number;
  onChangeBudget: (brlCents: number) => void;
  needsSetup: boolean;
  setupLabel: string;
}

/**
 * Simulador de investimento. A taxa cai conforme a verba sobe, então o destaque
 * é sempre quanto falta para a próxima faixa — é o que convence a subir o valor.
 */
export function InvestmentSimulator({
  adBudgetBrlCents,
  onChangeBudget,
  needsSetup,
  setupLabel,
}: InvestmentSimulatorProps) {
  const quote = useMemo(
    () => quoteTrafego(adBudgetBrlCents, needsSetup),
    [adBudgetBrlCents, needsSetup],
  );
  const sliderValue = Math.min(quote.adBudgetBrlCents, SLIDER_MAX);

  function handleTyped(raw: string) {
    const digits = raw.replace(/\D/g, "");
    onChangeBudget(digits ? Number(digits) : 0);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-white/35">R$</span>
          <input
            inputMode="numeric"
            value={(adBudgetBrlCents / 100).toFixed(2).replace(".", ",")}
            onChange={(event) => handleTyped(event.target.value)}
            className="w-full bg-transparent text-[2.25rem] font-bold leading-none tracking-tight text-white outline-none"
            aria-label="Verba de tráfego em reais"
          />
        </div>

        <input
          type="range"
          min={MIN_AD_BUDGET_BRL_CENTS}
          max={SLIDER_MAX}
          step={10_000}
          value={sliderValue}
          onChange={(event) => onChangeBudget(Number(event.target.value))}
          className="mt-5 w-full accent-violet-500"
          aria-label="Ajustar verba"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChangeBudget(preset)}
              className={cn(
                "rounded-lg border px-3.5 py-1.5 text-xs font-medium transition",
                adBudgetBrlCents === preset
                  ? "border-violet-400 bg-violet-500/15 text-violet-100"
                  : "border-white/[0.09] text-white/45 hover:border-white/25 hover:text-white/70",
              )}
            >
              {formatBrlFromCents(preset)}
            </button>
          ))}
        </div>

        {adBudgetBrlCents < MIN_AD_BUDGET_BRL_CENTS && (
          <p className="mt-3 text-xs text-amber-300">
            O investimento mínimo é {formatBrlFromCents(MIN_AD_BUDGET_BRL_CENTS)}.
            Vamos simular com esse valor.
          </p>
        )}
        {adBudgetBrlCents > MAX_AD_BUDGET_BRL_CENTS && (
          <p className="mt-3 text-xs text-amber-300">
            Acima de {formatBrlFromCents(MAX_AD_BUDGET_BRL_CENTS)} o plano é montado
            junto com um gestor. Simulamos com o teto — fale com a gente para valores
            maiores.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4 sm:p-5">
        <OrderSummary quote={quote} needsSetup={needsSetup} setupLabel={setupLabel} />
      </div>

      {quote.nextTierGapBrlCents !== null && quote.nextTierGapBrlCents > 0 && (
        <button
          type="button"
          onClick={() =>
            onChangeBudget(quote.adBudgetBrlCents + quote.nextTierGapBrlCents!)
          }
          className="flex w-full items-start gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-3.5 text-left transition hover:border-emerald-400/50"
        >
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <span className="min-w-0 text-xs leading-relaxed text-emerald-100">
            Investindo <strong>{formatBrlFromCents(quote.nextTierGapBrlCents)}</strong> a
            mais, sua taxa cai para <strong>{quote.nextTierFeePercent}%</strong>
            {needsSetup &&
              quote.tier.setupBrlCents > 0 &&
              nextTierHasFreeSetup(quote.feePercent) &&
              " e o setup fica grátis"}
            .
            {quote.nextTierSavingBrlCents !== null && quote.nextTierSavingBrlCents > 0 && (
              <>
                {" "}
                Você paga{" "}
                <strong>{formatBrlFromCents(quote.nextTierSavingBrlCents)} a menos</strong>{" "}
                no total — e ainda anuncia mais.
              </>
            )}
          </span>
        </button>
      )}

      <TierTable currentTierId={quote.tier.id} needsSetup={needsSetup} />
    </div>
  );
}

function nextTierHasFreeSetup(currentFeePercent: number): boolean {
  const index = TRAFEGO_TIERS.findIndex((tier) => tier.feePercent === currentFeePercent);
  return TRAFEGO_TIERS[index + 1]?.setupBrlCents === 0;
}

/** Colapsada por padrão: quem quer conferir a régua inteira abre. */
function TierTable({
  currentTierId,
  needsSetup,
}: {
  currentTierId: string;
  needsSetup: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70"
      >
        Ver todas as faixas
        <ChevronDown
          className={cn("size-3.5 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.09]">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">Investimento</th>
                <th className="px-3 py-2 text-right font-medium">Taxa</th>
                {needsSetup && <th className="px-3 py-2 text-right font-medium">Setup</th>}
              </tr>
            </thead>
            <tbody>
              {TRAFEGO_TIERS.map((tier) => {
                const isCurrent = tier.id === currentTierId;
                return (
                  <tr
                    key={tier.id}
                    className={cn("border-t border-white/5", isCurrent && "bg-violet-500/10")}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          isCurrent ? "font-semibold text-white" : "text-white/55",
                        )}
                      >
                        {isCurrent && <Check className="size-3 text-violet-300" />}
                        {tier.label}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        isCurrent ? "font-semibold text-white" : "text-white/55",
                      )}
                    >
                      {tier.feePercent}%
                    </td>
                    {needsSetup && (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {tier.setupBrlCents === 0 ? (
                          <span className="font-semibold text-emerald-300">Grátis</span>
                        ) : (
                          <span className={isCurrent ? "text-white" : "text-white/55"}>
                            {formatBrlFromCents(tier.setupBrlCents)}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TalkToManagerButton({
  whatsappNumber,
  message,
}: {
  whatsappNumber: string;
  message: string;
}) {
  const href = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
    >
      <MessageCircle className="size-4" />
      Falar com um gestor
    </a>
  );
}
