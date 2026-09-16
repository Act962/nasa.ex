import "server-only";

import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { ENTRY_INCLUDE, formatCents, type PaymentActor } from "./entry-include";

// Baixa (total ou parcial) de um lançamento. Devolve um resultado
// discriminado em vez de lançar, para que a procedure escolha o erro HTTP e a
// tool do Astro escolha a frase.

export type PayEntryFailureReason = "not_found" | "cancelled" | "settled" | "over_remaining";

export type PayEntryResult =
  | { ok: true; entry: Awaited<ReturnType<typeof updateEntryAsPaid>>; status: "PAID" | "PARTIAL" }
  | { ok: false; reason: PayEntryFailureReason; message: string };

async function updateEntryAsPaid(params: {
  entryId: string;
  paidAmount: number;
  status: "PAID" | "PARTIAL";
  paidAt: Date;
  accountId?: string;
}) {
  return prisma.paymentEntry.update({
    where: { id: params.entryId },
    data: {
      paidAmount: params.paidAmount,
      status: params.status,
      paidAt: params.paidAt,
      ...(params.accountId ? { accountId: params.accountId } : {}),
    },
    include: ENTRY_INCLUDE,
  });
}

export async function payPaymentEntryRecord(params: {
  organizationId: string;
  actor: PaymentActor;
  entryId: string;
  paidAmountCents: number;
  paidAt?: string | Date;
  accountId?: string;
}): Promise<PayEntryResult> {
  const { organizationId, actor, entryId } = params;

  const existing = await prisma.paymentEntry.findFirst({
    where: { id: entryId, organizationId },
  });
  if (!existing) {
    return { ok: false, reason: "not_found", message: "Lançamento não encontrado" };
  }
  if (existing.status === "CANCELLED") {
    return { ok: false, reason: "cancelled", message: "Lançamento cancelado não aceita pagamento" };
  }

  const remaining = existing.amount - existing.paidAmount;
  if (remaining <= 0) {
    return { ok: false, reason: "settled", message: "Lançamento já está quitado" };
  }
  if (params.paidAmountCents > remaining) {
    return {
      ok: false,
      reason: "over_remaining",
      message: `Valor acima do saldo devedor (${formatCents(remaining)})`,
    };
  }

  const newPaid = existing.paidAmount + params.paidAmountCents;
  const status = newPaid >= existing.amount ? "PAID" : "PARTIAL";
  const paidAt = params.paidAt ? new Date(params.paidAt) : new Date();

  const entry = await updateEntryAsPaid({
    entryId,
    paidAmount: newPaid,
    status,
    paidAt,
    accountId: params.accountId,
  });

  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name ?? "",
    userEmail: actor.email ?? "",
    userImage: actor.image,
    appSlug: "payment",
    subAppSlug: "payment-entries",
    featureKey: status === "PAID" ? "payment.entry.paid" : "payment.entry.partial",
    action: status === "PAID" ? "payment.entry.paid" : "payment.entry.partial",
    actionLabel:
      status === "PAID"
        ? `Quitou "${entry.description}" (${formatCents(params.paidAmountCents)})`
        : `Recebeu parcial em "${entry.description}" (${formatCents(params.paidAmountCents)})`,
    resource: entry.description,
    resourceId: entry.id,
    metadata: {
      paidAmount: params.paidAmountCents,
      totalPaid: newPaid,
      totalAmount: existing.amount,
      type: existing.type,
    },
  });

  return { ok: true, entry, status };
}
