import { applyBps, formatBps, formatCentsBrl } from "../../format";
import type { CalculationResult } from "../types";

export interface DepreciationInput {
  assetCostCents: number;
  residualValueCents: number;
  usefulLifeMonths: number;
}

export function computeStraightLineDepreciation(
  input: DepreciationInput,
): CalculationResult<{ monthlyCents: number; annualCents: number }> {
  const depreciableCents = Math.max(0, input.assetCostCents - input.residualValueCents);
  const monthlyCents = input.usefulLifeMonths > 0 ? Math.round(depreciableCents / input.usefulLifeMonths) : 0;
  return {
    output: { monthlyCents, annualCents: monthlyCents * 12 },
    steps: [
      {
        label: "Valor depreciável",
        formula: `${formatCentsBrl(input.assetCostCents)} − ${formatCentsBrl(input.residualValueCents)}`,
        value: formatCentsBrl(depreciableCents),
        termId: "depreciacao",
      },
      {
        label: "Depreciação mensal (linear)",
        formula: `${formatCentsBrl(depreciableCents)} ÷ ${input.usefulLifeMonths} meses`,
        value: formatCentsBrl(monthlyCents),
        legalSource: "IN RFB 1.700/2017, Anexo III (taxas usuais)",
      },
    ],
    warnings: [],
    sources: [],
  };
}

export interface InterestInput {
  principalCents: number;
  monthlyRateBps: number;
  months: number;
  isCompound: boolean;
}

export function computeInterest(input: InterestInput): CalculationResult<{ totalCents: number; interestCents: number }> {
  const totalCents = input.isCompound
    ? Math.round(input.principalCents * Math.pow(1 + input.monthlyRateBps / 10000, input.months))
    : input.principalCents + applyBps(input.principalCents, input.monthlyRateBps * input.months);
  const interestCents = totalCents - input.principalCents;
  return {
    output: { totalCents, interestCents },
    steps: [
      {
        label: input.isCompound ? "Juros compostos" : "Juros simples",
        formula: input.isCompound
          ? `${formatCentsBrl(input.principalCents)} × (1 + ${formatBps(input.monthlyRateBps)})^${input.months}`
          : `${formatCentsBrl(input.principalCents)} × ${formatBps(input.monthlyRateBps)} × ${input.months}`,
        value: formatCentsBrl(totalCents),
      },
      { label: "Juros", value: formatCentsBrl(interestCents) },
    ],
    warnings: [],
    sources: [],
  };
}
