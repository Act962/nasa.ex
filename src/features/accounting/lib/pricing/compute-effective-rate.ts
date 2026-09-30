import { applyBps, formatBps } from "../format";
import { selectSingleRate } from "../tax/rate-lookup";
import {
  computeEffectiveRateBps,
  resolveAnnexByFatorR,
  computeFatorR,
  type SimplesAnnex,
} from "../tax/simples/compute-das";
import { resolveLegacyTaxRemainingBps } from "../tax/reforma/compute-cbs-ibs";
import type { CalculationResult, CalculationStep, CalculationWarning, TaxRateRow, TaxRegimeCode } from "../tax/types";

export interface EffectiveRateProfile {
  regime: TaxRegimeCode;
  simplesAnnex: string | null;
  isFatorRSubject: boolean;
  payroll12mCents: number;
  presumedIrpjBaseBps: number;
  presumedCsllBaseBps: number;
  issRateBps: number | null;
  ibsCbsOutsideSimples: boolean;
}

export interface EffectiveRateInput {
  profile: EffectiveRateProfile;
  rbt12Cents: number;
  kind: "PRODUCT" | "SERVICE";
  /** Redução do cClassTrib (regime diferenciado), em bps. */
  reductionBps?: number;
  issRateBpsOverride?: number | null;
  rates: TaxRateRow[];
  at: Date;
}

export interface EffectiveRateOutput {
  rateBps: number;
  components: Array<{ label: string; rateBps: number }>;
}

/**
 * Carga tributária sobre o faturamento de um item, para precificar. É uma
 * estimativa de "imposto por R$ de venda" — no Lucro Real o IRPJ/CSLL
 * depende do lucro e fica de fora, com aviso.
 */
export function computeEffectiveRate(input: EffectiveRateInput): CalculationResult<EffectiveRateOutput> {
  const { profile, rates, at } = input;
  const components: Array<{ label: string; rateBps: number }> = [];
  const warnings: CalculationWarning[] = [];
  const year = at.getUTCFullYear();

  if (profile.regime === "MEI") {
    warnings.push({
      code: "mei_fixed",
      message: "No MEI o imposto é um valor fixo por mês: ele não varia com o preço.",
    });
    return finalize(components, warnings);
  }

  if (profile.regime === "SIMPLES") {
    const declaredAnnex = resolveDeclaredAnnex(profile.simplesAnnex, input.kind);
    const fatorRBps = computeFatorR(profile.payroll12mCents, input.rbt12Cents);
    const appliedAnnex = resolveAnnexByFatorR(declaredAnnex, profile.isFatorRSubject, fatorRBps);
    const annexRows = rates
      .filter((row) => row.tax === "DAS" && row.annex === appliedAnnex && row.validFrom <= at && (!row.validTo || row.validTo >= at))
      .sort((left, right) => (left.bracket ?? 0) - (right.bracket ?? 0));
    const bracketRow =
      annexRows.find((row) => row.revenueToCents !== null && input.rbt12Cents <= row.revenueToCents) ??
      annexRows[annexRows.length - 1];
    if (bracketRow) {
      components.push({
        label: `DAS Anexo ${appliedAnnex}`,
        rateBps: computeEffectiveRateBps(input.rbt12Cents, bracketRow.rateBps, bracketRow.deductionCents ?? 0),
      });
    }
    if (year >= 2027 && profile.ibsCbsOutsideSimples) {
      addCbsIbs(components, rates, at, input.reductionBps ?? 0);
      warnings.push({
        code: "outside_das_estimate",
        message: "Opção por fora do DAS: o DAS encolhe na parte de PIS/COFINS/ISS/ICMS. A estimativa soma CBS/IBS cheios.",
      });
    }
    return finalize(components, warnings);
  }

  if (profile.regime === "PRESUMIDO") {
    const irpjRow = selectSingleRate(rates, { tax: "IRPJ", regime: "PRESUMIDO", annex: "ALIQUOTA", at });
    const csllRow = selectSingleRate(rates, { tax: "CSLL", regime: "PRESUMIDO", annex: "ALIQUOTA", at });
    if (irpjRow) {
      components.push({ label: "IRPJ presumido", rateBps: applyBps(profile.presumedIrpjBaseBps, irpjRow.rateBps) });
    }
    if (csllRow) {
      components.push({ label: "CSLL presumida", rateBps: applyBps(profile.presumedCsllBaseBps, csllRow.rateBps) });
    }
    addPisCofins(components, rates, at, "CUMULATIVO");
  }

  if (profile.regime === "REAL") {
    addPisCofins(components, rates, at, "NAO_CUMULATIVO");
    warnings.push({
      code: "real_profit_based",
      message: "No Lucro Real o IRPJ/CSLL incide sobre o lucro, não sobre o preço — não entra nesta alíquota.",
    });
  }

  addCbsIbs(components, rates, at, input.reductionBps ?? 0);

  if (input.kind === "SERVICE") {
    const issRateBps = input.issRateBpsOverride ?? profile.issRateBps ?? 0;
    const remainingBps = resolveLegacyTaxRemainingBps(rates, "ISS", at);
    if (issRateBps > 0 && remainingBps > 0) {
      components.push({ label: "ISS", rateBps: applyBps(issRateBps, remainingBps) });
    }
  } else {
    warnings.push({
      code: "icms_not_included",
      message: "ICMS de produto depende de NCM, UF e substituição tributária: confirme com a tabela da SEFAZ-PI.",
    });
  }

  return finalize(components, warnings);
}

function resolveDeclaredAnnex(simplesAnnex: string | null, kind: "PRODUCT" | "SERVICE"): SimplesAnnex {
  if (simplesAnnex && ["I", "II", "III", "IV", "V"].includes(simplesAnnex)) {
    return simplesAnnex as SimplesAnnex;
  }
  return kind === "PRODUCT" ? "I" : "III";
}

function addPisCofins(
  components: Array<{ label: string; rateBps: number }>,
  rates: TaxRateRow[],
  at: Date,
  regime: "CUMULATIVO" | "NAO_CUMULATIVO",
) {
  const pisRow = selectSingleRate(rates, { tax: "PIS", annex: regime, at });
  const cofinsRow = selectSingleRate(rates, { tax: "COFINS", annex: regime, at });
  if (pisRow) components.push({ label: "PIS", rateBps: pisRow.rateBps });
  if (cofinsRow) components.push({ label: "COFINS", rateBps: cofinsRow.rateBps });
}

function addCbsIbs(
  components: Array<{ label: string; rateBps: number }>,
  rates: TaxRateRow[],
  at: Date,
  reductionBps: number,
) {
  // 2026 é informativo: não compõe preço.
  if (at.getUTCFullYear() < 2027) return;
  const remainingShareBps = 10000 - reductionBps;
  const cbsRow = selectSingleRate(rates, { tax: "CBS", at });
  const ibsRow = selectSingleRate(rates, { tax: "IBS", at });
  if (cbsRow) components.push({ label: "CBS", rateBps: applyBps(cbsRow.rateBps, remainingShareBps) });
  if (ibsRow) components.push({ label: "IBS", rateBps: applyBps(ibsRow.rateBps, remainingShareBps) });
}

function finalize(
  components: Array<{ label: string; rateBps: number }>,
  warnings: CalculationWarning[],
): CalculationResult<EffectiveRateOutput> {
  const rateBps = components.reduce((total, component) => total + component.rateBps, 0);
  const steps: CalculationStep[] = components.map((component) => ({
    label: component.label,
    value: formatBps(component.rateBps),
  }));
  steps.push({ label: "Carga sobre o faturamento", value: formatBps(rateBps), termId: "aliquota-efetiva" });
  return { output: { rateBps, components }, steps, warnings, sources: [] };
}
