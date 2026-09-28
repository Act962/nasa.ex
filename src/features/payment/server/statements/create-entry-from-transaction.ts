import "server-only";

import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { statementFailure, type StatementActor, type StatementFailure } from "./service-result";

// Transação do extrato sem lançamento correspondente vira um lançamento novo,
// já quitado e já conciliado.

export async function loadPendingStatementTransaction(params: {
  organizationId: string;
  transactionId: string;
}) {
  const transaction = await prisma.paymentBankTransaction.findFirst({
    where: { id: params.transactionId, organizationId: params.organizationId },
  });
  if (!transaction) return statementFailure("not_found", "Transação não encontrada");
  if (transaction.status !== "PENDING") {
    return statementFailure("invalid", "Esta transação já foi resolvida");
  }
  return { ok: true as const, transaction };
}

export type CreateEntryFromTransactionResult = { ok: true; entryId: string } | StatementFailure;

export async function createEntryFromStatementTransaction(params: {
  organizationId: string;
  actor: StatementActor;
  transactionId: string;
  description: string;
  categoryId?: string | null;
  contactId?: string | null;
}): Promise<CreateEntryFromTransactionResult> {
  const loaded = await loadPendingStatementTransaction(params);
  if (!loaded.ok) return loaded;
  const { transaction } = loaded;

  const entryId = await prisma.$transaction(async (tx) => {
    const entry = await tx.paymentEntry.create({
      data: {
        organizationId: params.organizationId,
        createdById: params.actor.id,
        type: transaction.direction === "CREDIT" ? "RECEIVABLE" : "PAYABLE",
        description: params.description,
        amount: transaction.amountCents,
        paidAmount: transaction.amountCents,
        // Nasce quitado e sem passar por aprovação: o dinheiro já se moveu
        // na conta, e aprovar um fato consumado só encheria a fila.
        status: "PAID",
        dueDate: transaction.postedDate,
        paidAt: transaction.postedDate,
        accountId: transaction.accountId,
        categoryId: params.categoryId ?? null,
        contactId: params.contactId ?? null,
        notes: transaction.memo,
      },
      select: { id: true },
    });

    await tx.paymentBankTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "MATCHED",
        matchedEntryId: entry.id,
        matchedAt: new Date(),
        matchedById: params.actor.id,
        matchMethod: "CREATED",
      },
    });

    return entry.id;
  });

  await logActivity({
    organizationId: params.organizationId,
    userId: params.actor.id,
    userName: params.actor.name,
    userEmail: params.actor.email,
    appSlug: "payment",
    subAppSlug: "payment-statements",
    featureKey: "payment.statement.entry_created",
    action: "payment.statement.entry_created",
    actionLabel: `Criou "${params.description}" a partir do extrato`,
    resource: params.description,
    resourceId: entryId,
    metadata: { transactionId: transaction.id, amountCents: transaction.amountCents },
  });

  return { ok: true, entryId };
}
