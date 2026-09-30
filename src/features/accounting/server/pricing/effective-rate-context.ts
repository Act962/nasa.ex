import "server-only";

import { computeEffectiveRate } from "@/features/accounting/lib/pricing/compute-effective-rate";
import { toMonthKey } from "@/features/accounting/lib/format";
import { selectSingleRate } from "@/features/accounting/lib/tax/rate-lookup";
import { getOrCreateTaxProfile, toEffectiveRateProfile } from "@/features/accounting/server/profile/tax-profile";
import { loadTaxRates } from "@/features/accounting/server/tax-rates/load-tax-rates";
import { loadRbt12 } from "@/features/accounting/server/revenue/load-revenue";

// Alíquota efetiva "imposto por R$ de venda" do perfil fiscal: carrega perfil,
// tabelas e RBT12 uma vez e calcula para qualquer tipo/redução (diagnóstico de
// vários produtos sem repetir consulta).

export interface EffectiveRateRequest {
  kind: "PRODUCT" | "SERVICE";
  reductionBps?: number;
  issRateBpsOverride?: number | null;
}

export const REFORM_COMPARISON_YEARS = [2027, 2033] as const;

export async function loadEffectiveRateContext(organizationId: string) {
  const now = new Date();
  const [profile, rates] = await Promise.all([getOrCreateTaxProfile(organizationId), loadTaxRates(organizationId)]);
  const rbt12 = await loadRbt12({ organizationId, periodMonth: toMonthKey(now), openedAt: profile.openedAt });
  const effectiveRateProfile = toEffectiveRateProfile(profile);

  function computeAt(request: EffectiveRateRequest, at: Date) {
    return computeEffectiveRate({
      profile: effectiveRateProfile,
      rbt12Cents: rbt12.rbt12Cents,
      kind: request.kind,
      reductionBps: request.reductionBps ?? 0,
      issRateBpsOverride: request.issRateBpsOverride ?? null,
      rates,
      at,
    });
  }

  /** CBS/IBS de referência ainda não fixados pelo Senado vêm marcados como estimados. */
  function isEstimatedAt(at: Date): boolean {
    const cbsRow = selectSingleRate(rates, { tax: "CBS", at });
    const ibsRow = selectSingleRate(rates, { tax: "IBS", at });
    return Boolean(cbsRow?.note?.includes("estimada") || ibsRow?.note?.includes("estimada"));
  }

  function computeWithComparison(request: EffectiveRateRequest) {
    const today = computeAt(request, now);
    const comparison = REFORM_COMPARISON_YEARS.map((year) => {
      const at = new Date(Date.UTC(year, 6, 1));
      return { year, rateBps: computeAt(request, at).output.rateBps, isEstimated: isEstimatedAt(at) };
    });
    return {
      rateBps: today.output.rateBps,
      components: today.output.components,
      steps: today.steps,
      warnings: today.warnings,
      sources: today.sources,
      comparison,
    };
  }

  return {
    regime: profile.regime,
    rbt12Cents: rbt12.rbt12Cents,
    isRbt12Proportional: rbt12.isProportional,
    rateBpsFor: (request: EffectiveRateRequest) => computeAt(request, now).output.rateBps,
    computeWithComparison,
  };
}
