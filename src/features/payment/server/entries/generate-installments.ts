import "server-only";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { addCalendarMonths } from "@/features/payment/lib/dates";
import { MAX_INSTALLMENTS } from "@/features/payment/schemas/entry-form-schema";
import type { PaymentActor } from "./entry-include";

// Transforma um lançamento avulso (ou uma parcela solta) na série completa:
// gera só as posições que faltam, mês a mês, a partir da parcela atual.

export type GenerateInstallmentsFailureReason =
  | "not_found"
  | "cancelled"
  | "invalid_total"
  | "nothing_to_create";

export type GenerateInstallmentsResult =
  | { ok: true; createdCount: number; groupId: string; installmentTotal: number }
  | { ok: false; reason: GenerateInstallmentsFailureReason; message: string };

export async function generateEntryInstallments(params: {
  organizationId: string;
  actor: PaymentActor;
  entryId: string;
  /** Quantas parcelas a série passa a ter no total, contando a atual. */
  installmentTotal: number;
}): Promise<GenerateInstallmentsResult> {
  const { organizationId, actor, entryId, installmentTotal } = params;

  const source = await prisma.paymentEntry.findFirst({
    where: { id: entryId, organizationId },
  });
  if (!source) {
    return { ok: false, reason: "not_found", message: "Lançamento não encontrado" };
  }
  if (source.status === "CANCELLED") {
    return {
      ok: false,
      reason: "cancelled",
      message: "Lançamento cancelado não gera parcelas",
    };
  }
  if (installmentTotal < 2 || installmentTotal > MAX_INSTALLMENTS) {
    return {
      ok: false,
      reason: "invalid_total",
      message: `Informe um total entre 2 e ${MAX_INSTALLMENTS} parcelas`,
    };
  }

  const currentPosition = source.installmentCurrent ?? 1;
  if (currentPosition >= installmentTotal) {
    return {
      ok: false,
      reason: "invalid_total",
      message: `Esta já é a parcela ${currentPosition}; o total precisa ser maior que isso`,
    };
  }

  const groupId = source.installmentGroupId ?? randomUUID();

  // Uma série já parcialmente gerada não pode ganhar duplicatas: só as posições
  // que ainda não existem no grupo entram.
  const existingPositions = new Set<number>(
    source.installmentGroupId
      ? (
          await prisma.paymentEntry.findMany({
            where: { organizationId, installmentGroupId: groupId },
            select: { installmentCurrent: true },
          })
        )
          .map((entry) => entry.installmentCurrent)
          .filter((position): position is number => position !== null)
      : [currentPosition],
  );

  const rows = Array.from(
    { length: installmentTotal - currentPosition },
    (_, index) => currentPosition + index + 1,
  )
    .filter((position) => !existingPositions.has(position))
    .map((position) => ({
      type: source.type,
      description: source.description,
      amount: source.amount,
      categoryId: source.categoryId,
      costCenterId: source.costCenterId,
      contactId: source.contactId,
      accountId: source.accountId,
      trackingId: source.trackingId,
      leadId: source.leadId,
      notes: source.notes,
      documentNumber: source.documentNumber,
      organizationId,
      createdById: actor.id,
      dueDate: addCalendarMonths(source.dueDate, position - currentPosition),
      competenceDate: source.competenceDate,
      installmentTotal,
      installmentCurrent: position,
      installmentGroupId: groupId,
      status: "PENDING" as const,
      dunningRuleId: source.type === "RECEIVABLE" ? source.dunningRuleId : null,
    }));

  if (rows.length === 0) {
    return {
      ok: false,
      reason: "nothing_to_create",
      message: "Todas as parcelas dessa série já existem",
    };
  }

  await prisma.$transaction([
    prisma.paymentEntry.createMany({ data: rows }),
    // As parcelas já existentes do grupo precisam concordar com o novo total,
    // senão a lista mostra "2/4" ao lado de "3/12" na mesma série.
    prisma.paymentEntry.updateMany({
      where: { organizationId, installmentGroupId: groupId },
      data: { installmentTotal },
    }),
    prisma.paymentEntry.update({
      where: { id: entryId },
      data: { installmentTotal, installmentCurrent: currentPosition, installmentGroupId: groupId },
    }),
  ]);

  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name ?? "",
    userEmail: actor.email ?? "",
    userImage: actor.image,
    appSlug: "payment",
    subAppSlug: "payment-entries",
    featureKey: "payment.entry.installments_generated",
    action: "payment.entry.installments_generated",
    actionLabel: `Gerou ${rows.length} parcela(s) de "${source.description}"`,
    resource: source.description,
    resourceId: source.id,
    metadata: {
      installmentTotal,
      createdCount: rows.length,
      groupId,
      type: source.type,
    },
  });

  return { ok: true, createdCount: rows.length, groupId, installmentTotal };
}
