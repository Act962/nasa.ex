"use client";

import type { GuardrailField, GuardrailWarning } from "@/features/trafego/lib/wizard-guardrails";

const FIELD_LABEL: Record<GuardrailField, string> = {
  message: "Texto do anúncio",
  headline: "Título",
  creative: "Criativo",
  objective: "Objetivo",
  audience: "Público",
  budget: "Verba",
};

/** Avisos que ficaram abertos, antes de pagar (spec 0129, RF-7). "Corrigir" leva ao passo do campo. */
export function OpenWarningsSummary({
  warnings,
  onFix,
}: {
  warnings: GuardrailWarning[];
  onFix: (field: GuardrailField) => void;
}) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/[0.07] p-4">
      <p className="text-sm font-semibold text-white">
        {warnings.length === 1 ? "1 ponto pode piorar o anúncio" : `${warnings.length} pontos podem piorar o anúncio`}
      </p>
      <ul className="mt-2 space-y-2">
        {warnings.map((warning) => (
          <li key={warning.id} className="flex items-start justify-between gap-3 text-xs">
            <span className="min-w-0 text-white/70">
              <span className="font-medium text-white/90">{FIELD_LABEL[warning.field]}:</span> {warning.message}
            </span>
            <button
              type="button"
              onClick={() => onFix(warning.field)}
              className="shrink-0 font-medium text-info transition hover:text-info/80"
            >
              Corrigir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
