import { applyBps, formatBps, formatCentsBrl } from "../../format";
import { describeSource, selectSingleRate } from "../rate-lookup";
import type { CalculationResult, CalculationStep, CalculationWarning, TaxRateRow, TaxRegimeCode } from "../types";

export interface ComputeCbsIbsInput {
  /** Receita tributável (saídas) do período. */
  revenueCents: number;
  /** Redução do regime diferenciado do cClassTrib, em bps (3000 = 30%). */
  reductionBps?: number;
  /** Créditos disponíveis das entradas (TaxCredit AVAILABLE). */
  cbsCreditsCents?: number;
  ibsCreditsCents?: number;
  regime: TaxRegimeCode;
  /** Simples/MEI que optou por recolher IBS/CBS por fora do DAS (a partir de 2027). */
  ibsCbsOutsideSimples?: boolean;
  rates: TaxRateRow[];
  at: Date;
}

export interface ComputeCbsIbsOutput {
  year: number;
  cbsRateBps: number;
  ibsRateBps: number;
  cbsDebitCents: number;
  ibsDebitCents: number;
  cbsCreditsUsedCents: number;
  ibsCreditsUsedCents: number;
  cbsDueCents: number;
  ibsDueCents: number;
  totalDueCents: number;
  /** 2026: só destaque na nota, sem recolhimento efetivo. */
  isInformativeOnly: boolean;
  /** Simples/MEI dentro do DAS: IBS/CBS já estão no DAS, não se somam. */
  isInsideDas: boolean;
}

const TEST_YEAR = 2026;

export function computeCbsIbs(input: ComputeCbsIbsInput): CalculationResult<ComputeCbsIbsOutput> {
  const steps: CalculationStep[] = [];
  const warnings: CalculationWarning[] = [];
  const sources: string[] = [];
  const year = input.at.getUTCFullYear();

  const cbsRow = selectSingleRate(input.rates, { tax: "CBS", at: input.at });
  const ibsRow = selectSingleRate(input.rates, { tax: "IBS", at: input.at });

  if (year < TEST_YEAR || (!cbsRow && !ibsRow)) {
    return {
      output: emptyOutput(year),
      steps: [{ label: "CBS/IBS", value: "Ainda não vigentes nesta data (início em 2026)." }],
      warnings: [],
      sources: [],
    };
  }

  const isSimplesLike = input.regime === "SIMPLES" || input.regime === "MEI";
  const isInsideDas = isSimplesLike && (year === TEST_YEAR || !input.ibsCbsOutsideSimples);
  const isInformativeOnly = year === TEST_YEAR;

  const reductionBps = input.reductionBps ?? 0;
  const taxableCents = applyBps(input.revenueCents, 10000 - reductionBps);
  if (reductionBps > 0) {
    steps.push({
      label: "Base após redução do regime diferenciado",
      formula: `${formatCentsBrl(input.revenueCents)} × (100% − ${formatBps(reductionBps)})`,
      value: formatCentsBrl(taxableCents),
      legalSource: "LC 214/2025, arts. 127 a 138 (reduções de 30%, 60% e 100%)",
      termId: "cclasstrib",
    });
  }

  const cbsRateBps = cbsRow?.rateBps ?? 0;
  const ibsRateBps = ibsRow?.rateBps ?? 0;
  const cbsDebitCents = applyBps(taxableCents, cbsRateBps);
  const ibsDebitCents = applyBps(taxableCents, ibsRateBps);

  if (cbsRow) {
    sources.push(describeSource(cbsRow));
    steps.push({
      label: `CBS ${year} (débito)`,
      formula: `${formatCentsBrl(taxableCents)} × ${formatBps(cbsRateBps)}`,
      value: formatCentsBrl(cbsDebitCents),
      legalSource: cbsRow.legalSource,
      termId: "cbs",
    });
  }
  if (ibsRow) {
    sources.push(describeSource(ibsRow));
    steps.push({
      label: `IBS ${year} (débito)`,
      formula: `${formatCentsBrl(taxableCents)} × ${formatBps(ibsRateBps)}`,
      value: formatCentsBrl(ibsDebitCents),
      legalSource: ibsRow.legalSource,
      termId: "ibs",
    });
  }

  const cbsCreditsUsedCents = Math.min(input.cbsCreditsCents ?? 0, cbsDebitCents);
  const ibsCreditsUsedCents = Math.min(input.ibsCreditsCents ?? 0, ibsDebitCents);
  if (cbsCreditsUsedCents + ibsCreditsUsedCents > 0) {
    steps.push({
      label: "Créditos das notas de entrada (não cumulatividade)",
      formula: `CBS ${formatCentsBrl(cbsCreditsUsedCents)} + IBS ${formatCentsBrl(ibsCreditsUsedCents)}`,
      value: `− ${formatCentsBrl(cbsCreditsUsedCents + ibsCreditsUsedCents)}`,
      legalSource: "LC 214/2025, art. 47 (crédito condicionado à extinção do débito)",
      termId: "credito-nao-cumulativo",
    });
  }

  const cbsDueCents = cbsDebitCents - cbsCreditsUsedCents;
  const ibsDueCents = ibsDebitCents - ibsCreditsUsedCents;
  const totalDueCents = isInformativeOnly || isInsideDas ? 0 : cbsDueCents + ibsDueCents;

  if (isInformativeOnly) {
    warnings.push({
      code: "test_year",
      message:
        "2026 é ano-teste: CBS/IBS saem destacados na nota, mas não são recolhidos por quem cumpre as obrigações acessórias.",
    });
  }
  if (isInsideDas && !isInformativeOnly) {
    warnings.push({
      code: "inside_das",
      message:
        "No Simples, IBS/CBS estão dentro do DAS. O cliente PJ só aproveita o crédito do que você recolheu — optar por fora pode tornar seu preço mais competitivo.",
    });
  }
  if (cbsRow?.note?.includes("estimada") || ibsRow?.note?.includes("estimada")) {
    warnings.push({
      code: "estimated_rate",
      message: "Alíquota de referência estimada — será fixada pelo Senado. Revise quando publicada.",
    });
  }

  steps.push({
    label: isInformativeOnly ? "A recolher (ano-teste)" : isInsideDas ? "A recolher fora do DAS" : "CBS + IBS a recolher",
    value: formatCentsBrl(totalDueCents),
  });

  return {
    output: {
      year,
      cbsRateBps,
      ibsRateBps,
      cbsDebitCents,
      ibsDebitCents,
      cbsCreditsUsedCents,
      ibsCreditsUsedCents,
      cbsDueCents,
      ibsDueCents,
      totalDueCents,
      isInformativeOnly,
      isInsideDas,
    },
    steps,
    warnings,
    sources,
  };
}

function emptyOutput(year: number): ComputeCbsIbsOutput {
  return {
    year,
    cbsRateBps: 0,
    ibsRateBps: 0,
    cbsDebitCents: 0,
    ibsDebitCents: 0,
    cbsCreditsUsedCents: 0,
    ibsCreditsUsedCents: 0,
    cbsDueCents: 0,
    ibsDueCents: 0,
    totalDueCents: 0,
    isInformativeOnly: false,
    isInsideDas: false,
  };
}

/** Parcela de ICMS/ISS que sobra no ano da transição (10000 = integral). */
export function resolveLegacyTaxRemainingBps(
  rates: TaxRateRow[],
  tax: "ISS" | "ICMS",
  at: Date,
): number {
  const row = selectSingleRate(rates, { tax, annex: "TRANSICAO", at });
  return row?.reductionBps ?? 10000;
}
