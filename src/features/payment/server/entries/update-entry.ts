import "server-only";

import prisma from "@/lib/prisma";
import { parseCalendarDate } from "@/features/payment/lib/dates";
import { ENTRY_INCLUDE, formatCents } from "./entry-include";

// Edição de lançamento com o estado de caixa revalidado (spec 0023): `amount`,
// `paidAmount` e `status` só são gravados juntos se descreverem o mesmo fato.

export type PaymentEntryStatus =
  | "PENDING_APPROVAL"
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface UpdatePaymentEntryPatch {
  description?: string;
  amount?: number;
  dueDate?: string;
  status?: PaymentEntryStatus;
  paidAmount?: number;
  paidAt?: string | null;
  categoryId?: string | null;
  costCenterId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  notes?: string | null;
  documentNumber?: string | null;
  installmentTotal?: number | null;
  installmentCurrent?: number | null;
  installmentGroupId?: string | null;
}

export type UpdateEntryResult =
  | { ok: true; entry: Awaited<ReturnType<typeof applyUpdate>> }
  | { ok: false; reason: "not_found" | "over_amount"; message: string };

/** Status que não descrevem caixa e por isso nunca são derivados do valor pago. */
const NON_CASH_STATUSES: readonly PaymentEntryStatus[] = ["PENDING_APPROVAL", "CANCELLED"];

/**
 * O status que o par (valor, pago) descreve. Só é usado quando o patch não diz
 * qual status quer — um `status` explícito é decisão do usuário, não do valor.
 */
function deriveStatusFromAmounts(params: {
  amount: number;
  paidAmount: number;
  currentStatus: PaymentEntryStatus;
}): PaymentEntryStatus {
  if (NON_CASH_STATUSES.includes(params.currentStatus)) return params.currentStatus;
  if (params.paidAmount <= 0) {
    // OVERDUE é PENDING com vencimento estourado: quem decide isso é a rotina de
    // vencimento, não esta função.
    return params.currentStatus === "OVERDUE" ? "OVERDUE" : "PENDING";
  }
  if (params.paidAmount >= params.amount) return "PAID";
  return "PARTIAL";
}

async function applyUpdate(entryId: string, patch: UpdatePaymentEntryPatch) {
  const { dueDate, paidAt, ...data } = patch;
  return prisma.paymentEntry.update({
    where: { id: entryId },
    data: {
      ...data,
      ...(dueDate ? { dueDate: parseCalendarDate(dueDate) } : {}),
      ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
    },
    include: ENTRY_INCLUDE,
  });
}

export async function updatePaymentEntryRecord(params: {
  organizationId: string;
  entryId: string;
  patch: UpdatePaymentEntryPatch;
}): Promise<UpdateEntryResult> {
  const existing = await prisma.paymentEntry.findFirst({
    where: { id: params.entryId, organizationId: params.organizationId },
    select: { id: true, amount: true, paidAmount: true, status: true },
  });
  if (!existing) {
    return { ok: false, reason: "not_found", message: "Lançamento não encontrado" };
  }

  const currentStatus = existing.status as PaymentEntryStatus;
  const nextAmount = params.patch.amount ?? existing.amount;
  let nextPaidAmount = params.patch.paidAmount ?? existing.paidAmount;

  // Marcar "pago" pela tela não exige digitar o valor: o status explícito
  // completa o pagamento sozinho.
  if (params.patch.status === "PAID" && nextPaidAmount < nextAmount) {
    nextPaidAmount = nextAmount;
  }

  if (nextPaidAmount > nextAmount) {
    return {
      ok: false,
      reason: "over_amount",
      message: `O valor pago (${formatCents(nextPaidAmount)}) não pode ser maior que o valor do lançamento (${formatCents(nextAmount)})`,
    };
  }

  const nextStatus =
    params.patch.status ??
    deriveStatusFromAmounts({
      amount: nextAmount,
      paidAmount: nextPaidAmount,
      currentStatus,
    });

  const entry = await applyUpdate(params.entryId, {
    ...params.patch,
    amount: nextAmount,
    paidAmount: nextPaidAmount,
    status: nextStatus,
    // Virar avulso solta o lançamento do grupo: deixá-lo lá com posição nula
    // faria uma geração futura recriar a posição que ele ocupava.
    ...(params.patch.installmentTotal === null
      ? { installmentCurrent: null, installmentGroupId: null }
      : {}),
  });
  return { ok: true, entry };
}
