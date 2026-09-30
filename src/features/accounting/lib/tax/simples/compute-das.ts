import { applyBps, formatBps, formatCentsBrl, ratioToBps } from "../../format";
import { describeSource, selectRates } from "../rate-lookup";
import type { CalculationResult, CalculationStep, CalculationWarning, TaxRateRow } from "../types";

export const SIMPLES_ANNEXES = ["I", "II", "III", "IV", "V"] as const;
export type SimplesAnnex = (typeof SIMPLES_ANNEXES)[number];

export const FATOR_R_THRESHOLD_BPS = 2800;
const SIMPLES_CEILING_CENTS = 480_000_000;
const SIMPLES_SUBLIMIT_CENTS = 360_000_000;

export interface ComputeDasInput {
  rbt12Cents: number;
  /** Receita do mês por anexo declarado (segregação). */
  monthRevenueByAnnex: Partial<Record<SimplesAnnex, number>>;
  /** Folha de 12 meses (salários + pró-labore + encargos) — Fator R. */
  payroll12mCents: number;
  /** Serviços sujeitos ao Fator R (os do Anexo V que podem ir para o III). */
  isFatorRSubject: boolean;
  rates: TaxRateRow[];
  at: Date;
}

export interface DasAnnexLine {
  declaredAnnex: SimplesAnnex;
  appliedAnnex: SimplesAnnex;
  revenueCents: number;
  bracket: number;
  nominalRateBps: number;
  deductionCents: number;
  effectiveRateBps: number;
  amountCents: number;
}

export interface ComputeDasOutput {
  rbt12Cents: number;
  fatorRBps: number | null;
  lines: DasAnnexLine[];
  totalRevenueCents: number;
  totalAmountCents: number;
  effectiveRateBps: number;
}

export function computeFatorR(payroll12mCents: number, rbt12Cents: number): number {
  return ratioToBps(payroll12mCents, rbt12Cents);
}

/** Anexo efetivo: Fator R ≥ 28% leva serviço do V para o III, e < 28% leva do III para o V. */
export function resolveAnnexByFatorR(
  declaredAnnex: SimplesAnnex,
  isFatorRSubject: boolean,
  fatorRBps: number,
): SimplesAnnex {
  if (!isFatorRSubject) return declaredAnnex;
  if (declaredAnnex !== "III" && declaredAnnex !== "V") return declaredAnnex;
  return fatorRBps >= FATOR_R_THRESHOLD_BPS ? "III" : "V";
}

/** Alíquota efetiva = (RBT12 × nominal − parcela a deduzir) ÷ RBT12. */
export function computeEffectiveRateBps(
  rbt12Cents: number,
  nominalRateBps: number,
  deductionCents: number,
): number {
  if (rbt12Cents <= 0) return nominalRateBps;
  const taxOnRbt12 = (rbt12Cents * nominalRateBps) / 10000 - deductionCents;
  return Math.max(0, Math.round((taxOnRbt12 / rbt12Cents) * 10000));
}

export function computeDas(input: ComputeDasInput): CalculationResult<ComputeDasOutput> {
  const steps: CalculationStep[] = [];
  const warnings: CalculationWarning[] = [];
  const sources = new Set<string>();

  const fatorRBps = input.isFatorRSubject
    ? computeFatorR(input.payroll12mCents, input.rbt12Cents)
    : null;

  if (fatorRBps !== null) {
    steps.push({
      label: "Fator R = folha 12 meses ÷ RBT12",
      formula: `${formatCentsBrl(input.payroll12mCents)} ÷ ${formatCentsBrl(input.rbt12Cents)}`,
      value: `${formatBps(fatorRBps)} (${fatorRBps >= FATOR_R_THRESHOLD_BPS ? "≥ 28% → Anexo III" : "< 28% → Anexo V"})`,
      legalSource: "LC 123/2006, art. 18 §5º-J e §5º-M",
      termId: "fator-r",
    });
  }

  if (input.rbt12Cents > SIMPLES_CEILING_CENTS) {
    warnings.push({
      code: "above_ceiling",
      message: "RBT12 acima de R$ 4,8 milhões: a empresa fica sujeita à exclusão do Simples Nacional.",
    });
  } else if (input.rbt12Cents > SIMPLES_SUBLIMIT_CENTS) {
    warnings.push({
      code: "above_sublimit",
      message: "RBT12 acima do sublimite de R$ 3,6 milhões: ICMS e ISS passam a ser recolhidos fora do DAS.",
    });
  }

  const lines: DasAnnexLine[] = [];
  for (const declaredAnnex of SIMPLES_ANNEXES) {
    const revenueCents = input.monthRevenueByAnnex[declaredAnnex] ?? 0;
    if (revenueCents <= 0) continue;

    const appliedAnnex = resolveAnnexByFatorR(declaredAnnex, input.isFatorRSubject, fatorRBps ?? 0);
    const annexRows = selectRates(input.rates, {
      tax: "DAS",
      regime: "SIMPLES",
      annex: appliedAnnex,
      at: input.at,
    }).sort((left, right) => (left.bracket ?? 0) - (right.bracket ?? 0));

    if (annexRows.length === 0) {
      warnings.push({
        code: "missing_table",
        message: `Tabela do Anexo ${appliedAnnex} não encontrada para ${input.at.toISOString().slice(0, 10)}.`,
      });
      continue;
    }

    const bracketRow =
      annexRows.find((row) => row.revenueToCents !== null && input.rbt12Cents <= row.revenueToCents) ??
      annexRows[annexRows.length - 1];

    const deductionCents = bracketRow.deductionCents ?? 0;
    const effectiveRateBps = computeEffectiveRateBps(input.rbt12Cents, bracketRow.rateBps, deductionCents);
    const amountCents = applyBps(revenueCents, effectiveRateBps);
    sources.add(describeSource(bracketRow));

    lines.push({
      declaredAnnex,
      appliedAnnex,
      revenueCents,
      bracket: bracketRow.bracket ?? 0,
      nominalRateBps: bracketRow.rateBps,
      deductionCents,
      effectiveRateBps,
      amountCents,
    });

    steps.push({
      label: `Anexo ${appliedAnnex}${appliedAnnex !== declaredAnnex ? ` (declarado ${declaredAnnex})` : ""} — ${bracketRow.bracket}ª faixa`,
      formula: `(${formatCentsBrl(input.rbt12Cents)} × ${formatBps(bracketRow.rateBps)} − ${formatCentsBrl(deductionCents)}) ÷ ${formatCentsBrl(input.rbt12Cents)}`,
      value: `alíquota efetiva ${formatBps(effectiveRateBps, 4)}`,
      legalSource: bracketRow.legalSource,
      termId: "aliquota-efetiva",
    });
    steps.push({
      label: `DAS do Anexo ${appliedAnnex}`,
      formula: `${formatCentsBrl(revenueCents)} × ${formatBps(effectiveRateBps, 4)}`,
      value: formatCentsBrl(amountCents),
    });
  }

  const totalRevenueCents = lines.reduce((total, line) => total + line.revenueCents, 0);
  const totalAmountCents = lines.reduce((total, line) => total + line.amountCents, 0);

  steps.push({
    label: "Total do DAS no mês",
    value: formatCentsBrl(totalAmountCents),
    termId: "das",
  });

  return {
    output: {
      rbt12Cents: input.rbt12Cents,
      fatorRBps,
      lines,
      totalRevenueCents,
      totalAmountCents,
      effectiveRateBps: ratioToBps(totalAmountCents, totalRevenueCents),
    },
    steps,
    warnings,
    sources: [...sources],
  };
}
