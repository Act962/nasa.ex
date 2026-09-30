import { shiftMonthKey } from "../../format";
import type { CalculationStep } from "../types";
import { formatCentsBrl } from "../../format";

export interface Rbt12Input {
  /** Mês de apuração "AAAA-MM". */
  periodMonth: string;
  /** Receita bruta por mês "AAAA-MM" → centavos. */
  revenueByMonth: Record<string, number>;
  /** Mês de abertura "AAAA-MM", quando a empresa tem menos de 12 meses. */
  openedMonth?: string | null;
}

export interface Rbt12Result {
  rbt12Cents: number;
  monthsConsidered: number;
  isProportional: boolean;
  steps: CalculationStep[];
}

/**
 * RBT12 = receita bruta dos 12 meses anteriores ao da apuração. Empresa com
 * menos de 12 meses usa a média dos meses anteriores × 12; no mês de início,
 * a própria receita do mês × 12 (LC 123/2006, art. 18 §§ 1º e 2º).
 */
export function computeRbt12(input: Rbt12Input): Rbt12Result {
  const previousMonths = Array.from({ length: 12 }, (_, index) =>
    shiftMonthKey(input.periodMonth, -(index + 1)),
  );
  const activeMonths = input.openedMonth
    ? previousMonths.filter((monthKey) => monthKey >= input.openedMonth!)
    : previousMonths;

  const sumCents = activeMonths.reduce(
    (total, monthKey) => total + (input.revenueByMonth[monthKey] ?? 0),
    0,
  );

  if (activeMonths.length === 12) {
    return {
      rbt12Cents: sumCents,
      monthsConsidered: 12,
      isProportional: false,
      steps: [
        {
          label: "RBT12 — receita bruta dos 12 meses anteriores",
          formula: `soma de ${previousMonths[11]} a ${previousMonths[0]}`,
          value: formatCentsBrl(sumCents),
          legalSource: "LC 123/2006, art. 18 §1º",
          termId: "rbt12",
        },
      ],
    };
  }

  if (activeMonths.length === 0) {
    const currentMonthCents = input.revenueByMonth[input.periodMonth] ?? 0;
    const rbt12Cents = currentMonthCents * 12;
    return {
      rbt12Cents,
      monthsConsidered: 0,
      isProportional: true,
      steps: [
        {
          label: "RBT12 proporcional (mês de início de atividade)",
          formula: `receita do mês × 12 = ${formatCentsBrl(currentMonthCents)} × 12`,
          value: formatCentsBrl(rbt12Cents),
          legalSource: "LC 123/2006, art. 18 §2º",
          termId: "rbt12",
        },
      ],
    };
  }

  const averageCents = Math.round(sumCents / activeMonths.length);
  const rbt12Cents = averageCents * 12;
  return {
    rbt12Cents,
    monthsConsidered: activeMonths.length,
    isProportional: true,
    steps: [
      {
        label: `RBT12 proporcional (${activeMonths.length} meses de atividade)`,
        formula: `média ${formatCentsBrl(averageCents)} × 12`,
        value: formatCentsBrl(rbt12Cents),
        legalSource: "LC 123/2006, art. 18 §2º",
        termId: "rbt12",
      },
    ],
  };
}
