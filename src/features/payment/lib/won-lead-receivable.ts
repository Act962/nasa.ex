// Regras puras do lançamento "A receber" gerado quando um lead vira GANHO (spec 0074).

export type WonLeadReceivableSkipReason = "no_amount" | "already_linked" | "no_actor";

export type WonLeadReceivableDecision =
  | { shouldCreate: true; amountCents: number }
  | { shouldCreate: false; reason: WonLeadReceivableSkipReason };

export function decideWonLeadReceivable(params: {
  /** `Lead.amount` já vem em centavos, mas como Decimal — pode chegar fracionado. */
  leadAmountCents: number;
  hasLinkedReceivable: boolean;
  hasActor: boolean;
}): WonLeadReceivableDecision {
  const amountCents = Math.round(params.leadAmountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { shouldCreate: false, reason: "no_amount" };
  }
  if (params.hasLinkedReceivable) {
    return { shouldCreate: false, reason: "already_linked" };
  }
  if (!params.hasActor) {
    return { shouldCreate: false, reason: "no_actor" };
  }
  return { shouldCreate: true, amountCents };
}

export function buildWonLeadReceivableDescription(leadName: string): string {
  const trimmedName = leadName.trim();
  return trimmedName ? `Venda — ${trimmedName}` : "Venda — lead sem nome";
}

/** "AAAA-MM-DD" no calendário de São Paulo: o servidor roda em UTC e viraria o dia às 21h. */
export function toSaoPauloDateInput(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
