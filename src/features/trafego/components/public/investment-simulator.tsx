"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Check, Info, MessageCircle } from "lucide-react";
import {
  MAX_AD_BUDGET_BRL_CENTS,
  MIN_AD_BUDGET_BRL_CENTS,
  TRAFEGO_MIN_SERVICE_FEE_BRL_CENTS,
  TRAFEGO_SERVICE_FEE_PERCENT,
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
  setupBrlCents: number;
  setupLabel: string;
  /** Só no WhatsApp Oficial o setup ainda varia por faixa de verba. */
  showSetupTiers: boolean;
}

/**
 * Simulador do serviço (spec 0123). A verba declarada só calcula a taxa: ela é
 * paga pelo cliente à Meta. O que a Órbita cobra é serviço + setup (R$ 450 uma vez por empresa, spec 0126).
 */
export function InvestmentSimulator({
  adBudgetBrlCents,
  onChangeBudget,
  setupBrlCents,
  setupLabel,
  showSetupTiers,
}: InvestmentSimulatorProps) {
  const quote = useMemo(
    () => quoteTrafego(adBudgetBrlCents, setupBrlCents),
    [adBudgetBrlCents, setupBrlCents],
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
          className="mt-5 w-full accent-info"
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
                  ? "border-info bg-info/15 text-foreground"
                  : "border-white/[0.09] text-white/45 hover:border-white/25 hover:text-white/70",
              )}
            >
              {formatBrlFromCents(preset)}
            </button>
          ))}
        </div>

        {adBudgetBrlCents < MIN_AD_BUDGET_BRL_CENTS && (
          <p className="mt-3 text-xs text-warning">
            O investimento mínimo é {formatBrlFromCents(MIN_AD_BUDGET_BRL_CENTS)}.
            Vamos simular com esse valor.
          </p>
        )}
        {adBudgetBrlCents > MAX_AD_BUDGET_BRL_CENTS && (
          <p className="mt-3 text-xs text-warning">
            Acima de {formatBrlFromCents(MAX_AD_BUDGET_BRL_CENTS)} o plano é montado
            junto com um gestor. Simulamos com o teto — fale com a gente para valores
            maiores.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4 sm:p-5">
        <OrderSummary quote={quote} setupLabel={setupLabel} />
      </div>

      <p className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info/10 p-3.5 text-xs leading-relaxed text-foreground/85">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <span>
          A verba você paga direto à Meta, no cartão da sua conta de anúncios. O serviço
          trafeGO é <strong>{TRAFEGO_SERVICE_FEE_PERCENT}% da verba</strong>, com mínimo de{" "}
          <strong>{formatBrlFromCents(TRAFEGO_MIN_SERVICE_FEE_BRL_CENTS)}</strong>. Se o gasto real
          passar do que você declarou, cobramos {TRAFEGO_SERVICE_FEE_PERCENT}% sobre a diferença.
        </span>
      </p>

      {showSetupTiers && <SetupTable currentTierId={quote.tier.id} />}
    </div>
  );
}

/** Colapsada por padrão: no WhatsApp Oficial o setup do número varia pela faixa de verba. */
function SetupTable({ currentTierId }: { currentTierId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70"
      >
        Ver o setup por faixa de verba
        <ChevronDown
          className={cn("size-3.5 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.09]">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">Verba</th>
                <th className="px-3 py-2 text-right font-medium">Setup</th>
              </tr>
            </thead>
            <tbody>
              {TRAFEGO_TIERS.map((tier) => {
                const isCurrent = tier.id === currentTierId;
                return (
                  <tr
                    key={tier.id}
                    className={cn("border-t border-white/5", isCurrent && "bg-info/10")}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          isCurrent ? "font-semibold text-white" : "text-white/55",
                        )}
                      >
                        {isCurrent && <Check className="size-3 text-info" />}
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {tier.setupBrlCents === 0 ? (
                        <span className="font-semibold text-success">Grátis</span>
                      ) : (
                        <span className={isCurrent ? "text-white" : "text-white/55"}>
                          {formatBrlFromCents(tier.setupBrlCents)}
                        </span>
                      )}
                    </td>
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
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/15 px-5 py-3 text-sm font-semibold text-success transition hover:bg-success/25"
    >
      <MessageCircle className="size-4" />
      Falar com um gestor
    </a>
  );
}
