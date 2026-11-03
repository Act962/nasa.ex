import { computeTrafegoServiceFee } from "./pricing-tiers";
import { formatDateInTimeZone } from "./order-meta-metrics";

/** Complemento da taxa pelo gasto real (spec 0123, RF-11..RF-15). Regras puras: o script de QA testa direto. */

/** Diferença mínima que vira cobrança: abaixo disso o custo de cobrar é maior que o valor. */
export const TRAFEGO_COMPLEMENT_MIN_BRL_CENTS = 3_000;
/** Dias depois do fim do pedido em que o gasto ainda conta (CB-6). */
export const TRAFEGO_COMPLEMENT_GRACE_DAYS = 3;
/** Prazo do complemento a partir do dia em que nasce. */
export const TRAFEGO_COMPLEMENT_DUE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export const OPEN_ENTRY_STATUSES = ["PENDING_APPROVAL", "PENDING", "PARTIAL", "OVERDUE"] as const;

/** Pedido sujeito a complemento: Meta, modelo novo e já foi ao ar (CA-13, CB-3). */
export const COMPLEMENT_ORDER_STATUSES = ["RUNNING", "PAUSED", "COMPLETED"] as const;

export function isComplementEligibleOrder(order: {
  platform: string;
  adBudgetPaidToMeta: boolean;
  startedAt: Date | null;
  status: string;
}): boolean {
  return (
    order.platform === "META_ADS" &&
    order.adBudgetPaidToMeta &&
    order.startedAt !== null &&
    (COMPLEMENT_ORDER_STATUSES as readonly string[]).includes(order.status)
  );
}

export interface ComplementEntrySnapshot {
  id: string;
  documentNumber: string | null;
  amount: number;
  paidAmount: number;
  status: "PENDING_APPROVAL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  dueDate: Date;
  dunningRuleId: string | null;
  createdAt: Date;
}

export function complementDocumentPrefix(orderCode: string): string {
  return `${orderCode}-C`;
}

/** `TG-0002-C1`, `-C2`… O próximo número considera os cancelados, para não repetir um número já usado. */
export function nextComplementDocumentNumber(orderCode: string, existingDocumentNumbers: (string | null)[]): string {
  const prefix = complementDocumentPrefix(orderCode);
  const highestIndex = existingDocumentNumbers.reduce((highest, documentNumber) => {
    if (!documentNumber?.startsWith(prefix)) return highest;
    const index = Number(documentNumber.slice(prefix.length));
    return Number.isInteger(index) && index > highest ? index : highest;
  }, 0);
  return `${prefix}${highestIndex + 1}`;
}

/** Período do gasto: do início do pedido até hoje, no máximo o fim + 3 dias. `null` = parou de calcular. */
export function resolveComplementWindow(params: {
  startedAt: Date | null;
  endsAt: Date | null;
  timeZone: string | null;
  now: Date;
}): { since: string; until: string } | null {
  if (!params.startedAt) return null;
  const lastCountedAt = params.endsAt ? new Date(params.endsAt.getTime() + TRAFEGO_COMPLEMENT_GRACE_DAYS * DAY_MS) : null;
  if (lastCountedAt && params.now.getTime() > lastCountedAt.getTime()) return null;
  const since = formatDateInTimeZone(params.startedAt, params.timeZone);
  const until = formatDateInTimeZone(params.now, params.timeZone);
  return { since: since > until ? until : since, until };
}

/** Gasto considerado: a conta toda menos as campanhas que a equipe tirou do trafeGO (CA-9). */
export function sumServiceSpendBrlCents(
  campaigns: { campaignId: string | null; spendBrlCents: number }[],
  outsideCampaignIds: string[],
): number {
  const outside = new Set(outsideCampaignIds);
  return campaigns.reduce(
    (total, campaign) => (campaign.campaignId && outside.has(campaign.campaignId) ? total : total + campaign.spendBrlCents),
    0,
  );
}

/** Taxa + complementos não cancelados. Pago em parte conta pelo valor cheio (CB-5). */
export function sumChargedServiceFeeBrlCents(serviceFeeBrlCents: number, complements: ComplementEntrySnapshot[]): number {
  return complements.reduce(
    (total, complement) => (complement.status === "CANCELLED" ? total : total + complement.amount),
    serviceFeeBrlCents,
  );
}

export interface ComplementDue {
  spentBrlCents: number;
  dueFeeBrlCents: number;
  chargedBrlCents: number;
  complementBrlCents: number;
  shouldCreate: boolean;
}

/**
 * `devido = max(30% × gasto, R$ 150)`. Só há complemento quando o gasto passou da verba
 * declarada (CA-10): uma taxa negociada abaixo dos 30% não vira cobrança sozinha.
 */
export function computeComplementDue(params: {
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  spentBrlCents: number;
  complements: ComplementEntrySnapshot[];
}): ComplementDue {
  const dueFeeBrlCents = computeTrafegoServiceFee(params.spentBrlCents);
  const chargedBrlCents = sumChargedServiceFeeBrlCents(params.serviceFeeBrlCents, params.complements);
  const complementBrlCents = Math.max(0, dueFeeBrlCents - chargedBrlCents);
  return {
    spentBrlCents: params.spentBrlCents,
    dueFeeBrlCents,
    chargedBrlCents,
    complementBrlCents,
    shouldCreate:
      params.spentBrlCents > params.adBudgetBrlCents && complementBrlCents >= TRAFEGO_COMPLEMENT_MIN_BRL_CENTS,
  };
}

/** Rascunho = ainda sem régua: o cliente não viu a cobrança (D-4). */
export function isComplementSent(complement: Pick<ComplementEntrySnapshot, "dunningRuleId">): boolean {
  return Boolean(complement.dunningRuleId);
}

export function isComplementOpen(complement: Pick<ComplementEntrySnapshot, "status">): boolean {
  return (OPEN_ENTRY_STATUSES as readonly string[]).includes(complement.status);
}

/** Vencimento = dia no calendário de Brasília (o `dueDate` é gravado ao meio-dia UTC). */
export function isComplementOverdue(
  complement: Pick<ComplementEntrySnapshot, "status" | "dueDate" | "dunningRuleId">,
  now: Date,
): boolean {
  if (!isComplementSent(complement) || !isComplementOpen(complement)) return false;
  const today = formatDateInTimeZone(now, "America/Sao_Paulo");
  return complement.dueDate.toISOString().slice(0, 10) < today;
}

/** Trava do painel (RF-15): só complemento enviado e vencido; rascunho vencido não trava (D-5). */
export function hasOverdueComplement(complements: ComplementEntrySnapshot[], now: Date): boolean {
  return complements.some((complement) => isComplementOverdue(complement, now));
}

export function complementDueDateInput(now: Date): string {
  return formatDateInTimeZone(new Date(now.getTime() + TRAFEGO_COMPLEMENT_DUE_DAYS * DAY_MS), "America/Sao_Paulo");
}
