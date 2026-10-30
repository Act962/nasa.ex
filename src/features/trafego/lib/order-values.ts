import type { TrafegoOrderStatus } from "@/generated/prisma/enums";

/** Valores do pedido e as regras puras do "Corrigir valores" (spec 0122, RF-16..RF-18). */

/** Nome gerado quando o pedido não vem de um plano do catálogo. Fonte única (antes copiado em dois lugares). */
export function buildTrafegoPlanName(adBudgetBrlCents: number): string {
  return `Tráfego ${(adBudgetBrlCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
}

export function isGeneratedTrafegoPlanName(planName: string): boolean {
  return planName.startsWith("Tráfego ");
}

export function deriveServiceFeePercent(serviceFeeBrlCents: number, adBudgetBrlCents: number): number {
  if (adBudgetBrlCents <= 0) return 0;
  return Math.round((serviceFeeBrlCents / adBudgetBrlCents) * 100);
}

/** Status em que a correção é aceita: antes de a campanha ir ao ar (RF-17). */
export const CORRECTABLE_ORDER_STATUSES: readonly TrafegoOrderStatus[] = [
  "PAID",
  "ACCOUNT_REVIEW",
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "REQUESTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
];

export function isOrderValueCorrectable(status: TrafegoOrderStatus): boolean {
  return CORRECTABLE_ORDER_STATUSES.includes(status);
}

export interface OrderMoneyValues {
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  setupFeeBrlCents: number;
  totalBrlCents: number;
  /** Spec 0123: verba paga à Meta, fora do total. */
  adBudgetPaidToMeta: boolean;
}

/** Verba que entra no total cobrado pela Órbita: zero no modelo novo (spec 0123). */
export function billedAdBudgetBrlCents(values: Pick<OrderMoneyValues, "adBudgetBrlCents" | "adBudgetPaidToMeta">): number {
  return values.adBudgetPaidToMeta ? 0 : values.adBudgetBrlCents;
}

/** Criativos extras não têm coluna: são o que sobra do total (docs/trafego-overview.md). */
export function deriveExtraCreativesBrlCents(values: OrderMoneyValues): number {
  return Math.max(
    0,
    values.totalBrlCents - billedAdBudgetBrlCents(values) - values.serviceFeeBrlCents - values.setupFeeBrlCents,
  );
}

export type OrderValuesCorrectionResult =
  | { ok: true; totalBrlCents: number; extraCreativesBrlCents: number }
  | { ok: false; reason: "status_not_correctable" | "landing_total_changed"; message: string };

export function planOrderValuesCorrection(params: {
  status: TrafegoOrderStatus;
  isLandingPurchase: boolean;
  current: OrderMoneyValues;
  next: Omit<OrderMoneyValues, "totalBrlCents" | "adBudgetPaidToMeta">;
}): OrderValuesCorrectionResult {
  if (!isOrderValueCorrectable(params.status)) {
    return {
      ok: false,
      reason: "status_not_correctable",
      message: "Só dá para corrigir valores antes de a campanha ir ao ar.",
    };
  }
  const extraCreativesBrlCents = deriveExtraCreativesBrlCents(params.current);
  const totalBrlCents =
    billedAdBudgetBrlCents({
      adBudgetBrlCents: params.next.adBudgetBrlCents,
      adBudgetPaidToMeta: params.current.adBudgetPaidToMeta,
    }) +
    params.next.serviceFeeBrlCents +
    params.next.setupFeeBrlCents +
    extraCreativesBrlCents;
  // O total da compra pela landing é o que o Stripe/Asaas cobrou: dá para redistribuir, não mudar.
  if (params.isLandingPurchase && totalBrlCents !== params.current.totalBrlCents) {
    return {
      ok: false,
      reason: "landing_total_changed",
      message: "Este pedido foi pago pela landing: redistribua os valores mantendo o total cobrado.",
    };
  }
  return { ok: true, totalBrlCents, extraCreativesBrlCents };
}

export interface FinanceEntrySnapshot {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: "PENDING_APPROVAL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  amount: number;
  paidAmount: number;
  reconciledTransactionsCount: number;
}

export type FinanceCorrectionPlan =
  | {
      ok: true;
      updates: { id: string; amount: number; paidAmount: number; status: FinanceEntrySnapshot["status"] }[];
      notes: string[];
    }
  | { ok: false; message: string };

/**
 * Ajuste dos lançamentos do pedido (RF-18, D-5). Recusa se o dinheiro já andou
 * de verdade: lançamento conciliado com o banco ou repasse de verba já pago.
 * Nunca cria lançamento novo: falta de lançamento vira só uma nota.
 */
export function planFinanceCorrection(params: {
  entries: FinanceEntrySnapshot[];
  nextAdBudgetBrlCents: number;
  nextRevenueBrlCents: number;
}): FinanceCorrectionPlan {
  const activeEntries = params.entries.filter((entry) => entry.status !== "CANCELLED");
  if (activeEntries.some((entry) => entry.reconciledTransactionsCount > 0)) {
    return { ok: false, message: "O financeiro deste pedido já foi conciliado com o banco: ajuste o lançamento à mão." };
  }

  const updates: Extract<FinanceCorrectionPlan, { ok: true }>["updates"] = [];
  const notes: string[] = [];

  const payable = activeEntries.find((entry) => entry.type === "PAYABLE");
  if (payable) {
    if (payable.paidAmount > 0 || payable.status === "PAID" || payable.status === "PARTIAL") {
      return { ok: false, message: "O repasse da verba deste pedido já foi pago: ajuste o financeiro à mão." };
    }
    updates.push({
      id: payable.id,
      amount: params.nextAdBudgetBrlCents,
      paidAmount: 0,
      status: params.nextAdBudgetBrlCents > 0 ? payable.status : "CANCELLED",
    });
  }

  const receivable = activeEntries.find((entry) => entry.type === "RECEIVABLE");
  if (receivable) {
    if (receivable.status === "PARTIAL") {
      return { ok: false, message: "A receita deste pedido está paga em parte: ajuste o financeiro à mão." };
    }
    const isFullyPaid = receivable.status === "PAID";
    updates.push({
      id: receivable.id,
      amount: params.nextRevenueBrlCents,
      paidAmount: isFullyPaid ? params.nextRevenueBrlCents : 0,
      status: params.nextRevenueBrlCents > 0 ? receivable.status : "CANCELLED",
    });
  } else if (params.nextRevenueBrlCents > 0 && activeEntries.length > 0) {
    notes.push("O pedido não tinha lançamento de receita: lance a taxa no Payment se ela foi recebida.");
  }

  if (activeEntries.length === 0) notes.push("Pedido sem lançamentos no financeiro: nada foi alterado lá.");
  return { ok: true, updates, notes };
}
