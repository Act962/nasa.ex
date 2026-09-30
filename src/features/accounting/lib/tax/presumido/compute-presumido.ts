import { applyBps, formatBps, formatCentsBrl } from "../../format";
import { describeSource, selectSingleRate } from "../rate-lookup";
import type { CalculationResult, CalculationStep, CalculationWarning, TaxRateRow } from "../types";

export interface ComputeIrpjCsllInput {
  /** Receita bruta do trimestre. */
  quarterRevenueCents: number;
  /** Presunção em bps (serviços em geral 3200; comércio 800 IRPJ / 1200 CSLL). */
  irpjBaseBps: number;
  csllBaseBps: number;
  rates: TaxRateRow[];
  at: Date;
}

export interface ComputeIrpjCsllOutput {
  irpjBaseCents: number;
  csllBaseCents: number;
  irpjCents: number;
  irpjAdditionalCents: number;
  csllCents: number;
  totalCents: number;
}

const QUARTER_ADDITIONAL_THRESHOLD_CENTS = 6_000_000;

export function computeIrpjCsllPresumido(
  input: ComputeIrpjCsllInput,
): CalculationResult<ComputeIrpjCsllOutput> {
  const steps: CalculationStep[] = [];
  const sources: string[] = [];

  const irpjRow = selectSingleRate(input.rates, { tax: "IRPJ", regime: "PRESUMIDO", annex: "ALIQUOTA", at: input.at });
  const additionalRow = selectSingleRate(input.rates, { tax: "IRPJ", regime: "PRESUMIDO", annex: "ADICIONAL", at: input.at });
  const csllRow = selectSingleRate(input.rates, { tax: "CSLL", regime: "PRESUMIDO", annex: "ALIQUOTA", at: input.at });

  const irpjBaseCents = applyBps(input.quarterRevenueCents, input.irpjBaseBps);
  const csllBaseCents = applyBps(input.quarterRevenueCents, input.csllBaseBps);
  const irpjCents = irpjRow ? applyBps(irpjBaseCents, irpjRow.rateBps) : 0;
  const additionalThresholdCents = additionalRow?.deductionCents ?? QUARTER_ADDITIONAL_THRESHOLD_CENTS;
  const irpjAdditionalCents = additionalRow
    ? applyBps(Math.max(0, irpjBaseCents - additionalThresholdCents), additionalRow.rateBps)
    : 0;
  const csllCents = csllRow ? applyBps(csllBaseCents, csllRow.rateBps) : 0;

  steps.push({
    label: "Base presumida do IRPJ",
    formula: `${formatCentsBrl(input.quarterRevenueCents)} × ${formatBps(input.irpjBaseBps)}`,
    value: formatCentsBrl(irpjBaseCents),
    legalSource: "Lei 9.249/1995, art. 15",
    termId: "lucro-presumido",
  });
  if (irpjRow) {
    sources.push(describeSource(irpjRow));
    steps.push({
      label: "IRPJ (15%)",
      formula: `${formatCentsBrl(irpjBaseCents)} × ${formatBps(irpjRow.rateBps)}`,
      value: formatCentsBrl(irpjCents),
      legalSource: irpjRow.legalSource,
    });
  }
  if (additionalRow) {
    sources.push(describeSource(additionalRow));
    steps.push({
      label: "Adicional de IRPJ (10% do que passar de R$ 60 mil no trimestre)",
      formula: `max(0; ${formatCentsBrl(irpjBaseCents)} − ${formatCentsBrl(additionalThresholdCents)}) × ${formatBps(additionalRow.rateBps)}`,
      value: formatCentsBrl(irpjAdditionalCents),
      legalSource: additionalRow.legalSource,
    });
  }
  steps.push({
    label: "Base presumida da CSLL",
    formula: `${formatCentsBrl(input.quarterRevenueCents)} × ${formatBps(input.csllBaseBps)}`,
    value: formatCentsBrl(csllBaseCents),
    legalSource: "Lei 9.249/1995, art. 20",
  });
  if (csllRow) {
    sources.push(describeSource(csllRow));
    steps.push({
      label: "CSLL (9%)",
      formula: `${formatCentsBrl(csllBaseCents)} × ${formatBps(csllRow.rateBps)}`,
      value: formatCentsBrl(csllCents),
      legalSource: csllRow.legalSource,
    });
  }

  const totalCents = irpjCents + irpjAdditionalCents + csllCents;
  steps.push({ label: "Total IRPJ + CSLL do trimestre", value: formatCentsBrl(totalCents) });

  return {
    output: { irpjBaseCents, csllBaseCents, irpjCents, irpjAdditionalCents, csllCents, totalCents },
    steps,
    warnings: [],
    sources,
  };
}

export interface ComputeMonthlyContributionsInput {
  monthRevenueCents: number;
  /** "CUMULATIVO" (Presumido) ou "NAO_CUMULATIVO" (Real). */
  pisCofinsRegime: "CUMULATIVO" | "NAO_CUMULATIVO";
  /** Créditos de PIS/COFINS do mês (só não cumulativo). */
  pisCofinsCreditsCents?: number;
  issRateBps: number | null;
  /** Parcela do ISS que ainda existe no ano (transição 2029–2033), em bps. */
  issRemainingBps?: number;
  rates: TaxRateRow[];
  at: Date;
}

export interface ComputeMonthlyContributionsOutput {
  pisCents: number;
  cofinsCents: number;
  issCents: number;
  totalCents: number;
}

export function computeMonthlyContributions(
  input: ComputeMonthlyContributionsInput,
): CalculationResult<ComputeMonthlyContributionsOutput> {
  const steps: CalculationStep[] = [];
  const sources: string[] = [];
  const warnings: CalculationWarning[] = [];

  const pisRow = selectSingleRate(input.rates, { tax: "PIS", annex: input.pisCofinsRegime, at: input.at });
  const cofinsRow = selectSingleRate(input.rates, { tax: "COFINS", annex: input.pisCofinsRegime, at: input.at });

  let pisCents = pisRow ? applyBps(input.monthRevenueCents, pisRow.rateBps) : 0;
  let cofinsCents = cofinsRow ? applyBps(input.monthRevenueCents, cofinsRow.rateBps) : 0;

  if (!pisRow && !cofinsRow) {
    warnings.push({
      code: "pis_cofins_extinct",
      message: "PIS e COFINS não existem mais nesta data (substituídos pela CBS a partir de 2027).",
    });
  }

  if (pisRow) {
    sources.push(describeSource(pisRow));
    steps.push({
      label: `PIS ${input.pisCofinsRegime === "CUMULATIVO" ? "cumulativo" : "não cumulativo"}`,
      formula: `${formatCentsBrl(input.monthRevenueCents)} × ${formatBps(pisRow.rateBps)}`,
      value: formatCentsBrl(pisCents),
      legalSource: pisRow.legalSource,
      termId: "pis-cofins",
    });
  }
  if (cofinsRow) {
    sources.push(describeSource(cofinsRow));
    steps.push({
      label: `COFINS ${input.pisCofinsRegime === "CUMULATIVO" ? "cumulativa" : "não cumulativa"}`,
      formula: `${formatCentsBrl(input.monthRevenueCents)} × ${formatBps(cofinsRow.rateBps)}`,
      value: formatCentsBrl(cofinsCents),
      legalSource: cofinsRow.legalSource,
      termId: "pis-cofins",
    });
  }

  if (input.pisCofinsRegime === "NAO_CUMULATIVO" && (input.pisCofinsCreditsCents ?? 0) > 0) {
    const credits = input.pisCofinsCreditsCents ?? 0;
    const pisShare = Math.round((credits * 165) / 925);
    pisCents = Math.max(0, pisCents - pisShare);
    cofinsCents = Math.max(0, cofinsCents - (credits - pisShare));
    steps.push({
      label: "Créditos de PIS/COFINS das entradas",
      value: `− ${formatCentsBrl(credits)}`,
      termId: "credito-nao-cumulativo",
    });
  }

  const remainingBps = input.issRemainingBps ?? 10000;
  const issRateBps = input.issRateBps ?? 0;
  const issCents = applyBps(applyBps(input.monthRevenueCents, issRateBps), remainingBps);
  if (issRateBps > 0) {
    steps.push({
      label: "ISS",
      formula:
        remainingBps < 10000
          ? `${formatCentsBrl(input.monthRevenueCents)} × ${formatBps(issRateBps)} × ${formatBps(remainingBps)} (transição)`
          : `${formatCentsBrl(input.monthRevenueCents)} × ${formatBps(issRateBps)}`,
      value: formatCentsBrl(issCents),
      legalSource: "LC 116/2003 e lei municipal",
      termId: "iss",
    });
  }

  const totalCents = pisCents + cofinsCents + issCents;
  return {
    output: { pisCents, cofinsCents, issCents, totalCents },
    steps,
    warnings,
    sources,
  };
}
