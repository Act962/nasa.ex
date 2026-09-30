import { applyBps, formatBps, formatCentsBrl } from "../../format";
import type { CalculationResult } from "../types";

export interface LatePaymentInput {
  principalCents: number;
  dueDate: Date;
  paymentDate: Date;
  /** Selic acumulada do mês seguinte ao vencimento até o mês anterior ao pagamento, em bps. */
  accumulatedSelicBps: number;
}

export interface LatePaymentOutput {
  daysLate: number;
  fineCents: number;
  interestCents: number;
  totalCents: number;
}

const DAILY_FINE_BPS = 33;
const FINE_CEILING_BPS = 2000;
const PAYMENT_MONTH_INTEREST_BPS = 100;
const DAY_MS = 86_400_000;

/**
 * Tributo federal em atraso: multa de mora de 0,33% ao dia (teto 20%) + juros
 * Selic acumulada + 1% no mês do pagamento (Lei 9.430/1996, art. 61).
 */
export function computeLatePayment(input: LatePaymentInput): CalculationResult<LatePaymentOutput> {
  const daysLate = Math.max(
    0,
    Math.floor((startOfDay(input.paymentDate) - startOfDay(input.dueDate)) / DAY_MS),
  );

  if (daysLate === 0) {
    return {
      output: { daysLate: 0, fineCents: 0, interestCents: 0, totalCents: input.principalCents },
      steps: [{ label: "Sem atraso", value: formatCentsBrl(input.principalCents) }],
      warnings: [],
      sources: [],
    };
  }

  const fineBps = Math.min(FINE_CEILING_BPS, daysLate * DAILY_FINE_BPS);
  const fineCents = applyBps(input.principalCents, fineBps);
  const isSameMonth =
    input.dueDate.getUTCFullYear() === input.paymentDate.getUTCFullYear() &&
    input.dueDate.getUTCMonth() === input.paymentDate.getUTCMonth();
  const interestBps = isSameMonth ? 0 : input.accumulatedSelicBps + PAYMENT_MONTH_INTEREST_BPS;
  const interestCents = applyBps(input.principalCents, interestBps);
  const totalCents = input.principalCents + fineCents + interestCents;

  return {
    output: { daysLate, fineCents, interestCents, totalCents },
    steps: [
      { label: "Principal", value: formatCentsBrl(input.principalCents) },
      {
        label: `Multa de mora (${daysLate} dias × 0,33%, teto 20%)`,
        formula: `${formatCentsBrl(input.principalCents)} × ${formatBps(fineBps)}`,
        value: formatCentsBrl(fineCents),
        legalSource: "Lei 9.430/1996, art. 61 §§ 1º e 2º",
        termId: "multa-mora",
      },
      {
        label: isSameMonth ? "Juros (pagamento no mesmo mês: sem juros)" : "Juros Selic acumulada + 1% no mês do pagamento",
        formula: isSameMonth ? undefined : `${formatCentsBrl(input.principalCents)} × ${formatBps(interestBps)}`,
        value: formatCentsBrl(interestCents),
        legalSource: "Lei 9.430/1996, art. 61 §3º",
        termId: "selic",
      },
      { label: "Total atualizado", value: formatCentsBrl(totalCents) },
    ],
    warnings: [],
    sources: [],
  };
}

function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
