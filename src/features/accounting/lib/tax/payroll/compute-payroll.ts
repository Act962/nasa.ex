import { applyBps, formatBps, formatCentsBrl } from "../../format";
import { selectRates, selectSingleRate } from "../rate-lookup";
import type { CalculationResult, CalculationStep, TaxRateRow } from "../types";

/** IRRF mensal pela tabela progressiva + redutor de 2026 (Lei 15.270/2025). */
export function computeMonthlyIrrf(params: {
  taxableCents: number;
  grossIncomeCents: number;
  rates: TaxRateRow[];
  at: Date;
}): { irrfCents: number; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];
  const brackets = selectRates(params.rates, { tax: "IRRF", annex: "TABELA_MENSAL", at: params.at }).sort(
    (left, right) => (left.bracket ?? 0) - (right.bracket ?? 0),
  );
  const bracketRow =
    brackets.find((row) => row.revenueToCents === null || params.taxableCents <= row.revenueToCents) ??
    brackets[brackets.length - 1];
  if (!bracketRow) return { irrfCents: 0, steps };

  let irrfCents = Math.max(0, applyBps(params.taxableCents, bracketRow.rateBps) - (bracketRow.deductionCents ?? 0));
  steps.push({
    label: `IRRF — ${bracketRow.bracket}ª faixa da tabela progressiva`,
    formula: `${formatCentsBrl(params.taxableCents)} × ${formatBps(bracketRow.rateBps)} − ${formatCentsBrl(bracketRow.deductionCents ?? 0)}`,
    value: formatCentsBrl(irrfCents),
    legalSource: bracketRow.legalSource,
    termId: "irrf",
  });

  const reducerRow = selectSingleRate(params.rates, { tax: "IRRF", annex: "REDUTOR_2026", at: params.at });
  if (reducerRow && irrfCents > 0) {
    const exemptionLimitCents = reducerRow.fixedAmountCents ?? 0;
    const phaseOutLimitCents = reducerRow.revenueToCents ?? 0;
    let reductionCents = 0;
    if (params.grossIncomeCents <= exemptionLimitCents) {
      reductionCents = irrfCents;
    } else if (params.grossIncomeCents <= phaseOutLimitCents) {
      // reductionBps do redutor está em milionésimos (ver seed).
      const variableCents = Math.round((params.grossIncomeCents * (reducerRow.reductionBps ?? 0)) / 1_000_000);
      reductionCents = Math.max(0, Math.min(irrfCents, (reducerRow.deductionCents ?? 0) - variableCents));
    }
    if (reductionCents > 0) {
      irrfCents -= reductionCents;
      steps.push({
        label: "Redutor da Lei 15.270/2025",
        value: `− ${formatCentsBrl(reductionCents)}`,
        legalSource: reducerRow.legalSource,
      });
    }
  }
  return { irrfCents, steps };
}

export interface ProLaboreInput {
  proLaboreCents: number;
  dependents: number;
  rates: TaxRateRow[];
  at: Date;
}

export interface ProLaboreOutput {
  inssCents: number;
  irrfCents: number;
  netCents: number;
}

const DEPENDENT_DEDUCTION_CENTS = 18_959;

/** Pró-labore: INSS de 11% até o teto e IRRF progressivo. Lucro distribuído é isento (Lei 9.249/1995, art. 10). */
export function computeProLabore(input: ProLaboreInput): CalculationResult<ProLaboreOutput> {
  const steps: CalculationStep[] = [];
  const inssRow = selectSingleRate(input.rates, { tax: "INSS", annex: "PRO_LABORE", at: input.at });
  const ceilingCents = inssRow?.revenueToCents ?? input.proLaboreCents;
  const inssBaseCents = Math.min(input.proLaboreCents, ceilingCents);
  const inssCents = inssRow ? applyBps(inssBaseCents, inssRow.rateBps) : 0;
  steps.push({
    label: "INSS do sócio (11% até o teto)",
    formula: `${formatCentsBrl(inssBaseCents)} × ${formatBps(inssRow?.rateBps ?? 0)}`,
    value: formatCentsBrl(inssCents),
    legalSource: inssRow?.legalSource,
    termId: "pro-labore",
  });

  const taxableCents = Math.max(0, input.proLaboreCents - inssCents - input.dependents * DEPENDENT_DEDUCTION_CENTS);
  const irrf = computeMonthlyIrrf({
    taxableCents,
    grossIncomeCents: input.proLaboreCents,
    rates: input.rates,
    at: input.at,
  });
  steps.push(...irrf.steps);

  const netCents = input.proLaboreCents - inssCents - irrf.irrfCents;
  steps.push({ label: "Pró-labore líquido", value: formatCentsBrl(netCents) });
  steps.push({
    label: "Comparação",
    value: "Lucro distribuído (apurado contabilmente) é isento de IR e INSS para o sócio.",
    legalSource: "Lei 9.249/1995, art. 10",
    termId: "distribuicao-lucros",
  });

  return {
    output: { inssCents, irrfCents: irrf.irrfCents, netCents },
    steps,
    warnings: [
      {
        code: "min_pro_labore",
        message: "Sócio que trabalha na empresa deve ter pró-labore; distribuir só lucro pode ser questionado pela Receita.",
      },
    ],
    sources: inssRow ? [inssRow.legalSource] : [],
  };
}

export interface EmployeeCostInput {
  salaryCents: number;
  /** Simples Anexos I, II, III e V não pagam a cota patronal à parte. */
  isPatronalInsideDas: boolean;
  ratBps: number;
  thirdPartiesBps: number;
  rates: TaxRateRow[];
  at: Date;
}

export interface EmployeeCostOutput {
  monthlyCostCents: number;
  chargesCents: number;
  chargesOverSalaryBps: number;
}

/** Custo mensal de um funcionário CLT com provisões de férias + 1/3 e 13º. */
export function computeEmployeeCost(input: EmployeeCostInput): CalculationResult<EmployeeCostOutput> {
  const steps: CalculationStep[] = [];
  const fgtsRow = selectSingleRate(input.rates, { tax: "FGTS", at: input.at });
  const patronalRow = selectSingleRate(input.rates, { tax: "INSS", annex: "PATRONAL", at: input.at });

  const vacationCents = Math.round((input.salaryCents * 4) / 3 / 12);
  const thirteenthCents = Math.round(input.salaryCents / 12);
  const payrollBaseCents = input.salaryCents + vacationCents + thirteenthCents;

  const fgtsCents = applyBps(payrollBaseCents, fgtsRow?.rateBps ?? 800);
  const patronalBps = input.isPatronalInsideDas ? 0 : (patronalRow?.rateBps ?? 2000) + input.ratBps + input.thirdPartiesBps;
  const patronalCents = applyBps(payrollBaseCents, patronalBps);

  steps.push({ label: "Salário", value: formatCentsBrl(input.salaryCents) });
  steps.push({ label: "Provisão de férias + 1/3 (÷ 12)", value: formatCentsBrl(vacationCents), termId: "provisao-ferias" });
  steps.push({ label: "Provisão de 13º (÷ 12)", value: formatCentsBrl(thirteenthCents) });
  steps.push({
    label: "FGTS 8%",
    formula: `${formatCentsBrl(payrollBaseCents)} × ${formatBps(fgtsRow?.rateBps ?? 800)}`,
    value: formatCentsBrl(fgtsCents),
    legalSource: fgtsRow?.legalSource,
  });
  steps.push({
    label: input.isPatronalInsideDas ? "INSS patronal (já dentro do DAS)" : "INSS patronal + RAT + terceiros",
    formula: input.isPatronalInsideDas ? undefined : `${formatCentsBrl(payrollBaseCents)} × ${formatBps(patronalBps)}`,
    value: formatCentsBrl(patronalCents),
    legalSource: patronalRow?.legalSource,
  });

  const chargesCents = vacationCents + thirteenthCents + fgtsCents + patronalCents;
  const monthlyCostCents = input.salaryCents + chargesCents;
  const chargesOverSalaryBps = Math.round((chargesCents / Math.max(1, input.salaryCents)) * 10000);
  steps.push({
    label: "Custo mensal total",
    value: `${formatCentsBrl(monthlyCostCents)} (encargos = ${formatBps(chargesOverSalaryBps)} do salário)`,
  });

  return { output: { monthlyCostCents, chargesCents, chargesOverSalaryBps }, steps, warnings: [], sources: [] };
}
