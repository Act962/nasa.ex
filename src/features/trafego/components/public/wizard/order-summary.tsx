"use client";

import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import type { TrafegoQuote } from "@/features/trafego/lib/pricing-tiers";

/**
 * Quebra do preço nas três parcelas. Aparece igual no simulador e no resumo do
 * contato — o cliente nunca vê um total que não sabe de onde veio.
 */
export function OrderSummary({
  quote,
  needsSetup,
  setupLabel,
  compact,
}: {
  quote: TrafegoQuote;
  needsSetup: boolean;
  setupLabel: string;
  compact?: boolean;
}) {
  return (
    <dl className={compact ? "space-y-1.5 text-sm" : "space-y-2.5 text-sm"}>
      <Row
        label="Verba de tráfego"
        hint="vai 100% para o anúncio"
        value={formatBrlFromCents(quote.adBudgetBrlCents)}
      />
      <Row
        label={`Serviço trafeGO (${quote.feePercent}%)`}
        hint="gestão, criativos e otimização"
        value={formatBrlFromCents(quote.serviceFeeBrlCents)}
      />
      {needsSetup && (
        <Row
          label={setupLabel}
          hint={quote.tier.setupBrlCents === 0 ? "grátis nesta faixa" : "cobrado uma única vez"}
          value={
            quote.tier.setupBrlCents === 0
              ? "Grátis"
              : formatBrlFromCents(quote.setupBrlCents)
          }
          highlight={quote.tier.setupBrlCents === 0}
        />
      )}

      <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
        <dt className="font-semibold text-white">Total</dt>
        <dd className="text-xl font-bold tabular-nums text-white">
          {formatBrlFromCents(quote.totalBrlCents)}
        </dd>
      </div>
    </dl>
  );
}

function Row({
  label,
  hint,
  value,
  highlight,
}: {
  label: string;
  hint?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-white/60">
        {label}
        {hint && <span className="ml-1.5 text-xs text-white/30">· {hint}</span>}
      </dt>
      <dd
        className={
          highlight
            ? "shrink-0 font-semibold tabular-nums text-emerald-300"
            : "shrink-0 tabular-nums text-white"
        }
      >
        {value}
      </dd>
    </div>
  );
}
