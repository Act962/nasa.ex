import "server-only";

import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { applyPaymentToEntry } from "./apply-payment";
import { statementFailure, type StatementActor, type StatementFailure } from "./service-result";

// Casa uma transação do extrato com um lançamento em aberto e dá a baixa.
// A validação é exportada à parte para a proposta do Astro recusar cedo.

export type ReconciliationMatchMethod = "MANUAL" | "SUGGESTION";

export async function loadReconciliationCandidate(params: {
  organizationId: string;
  transactionId: string;
  entryId: string;
}) {
  const [transaction, entry] = await Promise.all([
    prisma.paymentBankTransaction.findFirst({
      where: { id: params.transactionId, organizationId: params.organizationId },
    }),
    prisma.paymentEntry.findFirst({
      where: { id: params.entryId, organizationId: params.organizationId },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        status: true,
        description: true,
        type: true,
        dueDate: true,
        contact: { select: { name: true } },
      },
    }),
  ]);

  if (!transaction) return statementFailure("not_found", "Transação não encontrada");
  if (!entry) return statementFailure("not_found", "Lançamento não encontrado");
  if (transaction.status !== "PENDING") {
    return statementFailure("invalid", "Esta transação já foi resolvida");
  }
  if (entry.status === "CANCELLED") {
    return statementFailure("invalid", "Não é possível conciliar com um lançamento cancelado");
  }
  if (transaction.amountCents > entry.amount - entry.paidAmount) {
    return statementFailure("invalid", "O valor da transação é maior que o saldo em aberto do lançamento");
  }
  return { ok: true as const, transaction, entry };
}

export type ReconcileTransactionResult =
  | { ok: true; entryStatus: string; entryId: string; entryDescription: string; amountCents: number }
  | StatementFailure;

export async function reconcileStatementTransactionRecord(params: {
  organizationId: string;
  actor: StatementActor;
  transactionId: string;
  entryId: string;
  matchMethod?: ReconciliationMatchMethod;
}): Promise<ReconcileTransactionResult> {
  const candidate = await loadReconciliationCandidate(params);
  if (!candidate.ok) return candidate;
  const { transaction, entry } = candidate;

  const applied = await prisma.$transaction(async (tx) => {
    const appliedPayment = await applyPaymentToEntry(tx, {
      entryId: entry.id,
      amountCents: transaction.amountCents,
      paidAt: transaction.postedDate,
      accountId: transaction.accountId,
    });
    await tx.paymentBankTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "MATCHED",
        matchedEntryId: entry.id,
        matchedAt: new Date(),
        matchedById: params.actor.id,
        matchMethod: params.matchMethod ?? "MANUAL",
      },
    });
    return appliedPayment;
  });

  await logActivity({
    organizationId: params.organizationId,
    userId: params.actor.id,
    userName: params.actor.name,
    userEmail: params.actor.email,
    appSlug: "payment",
    subAppSlug: "payment-statements",
    featureKey: "payment.statement.reconciled",
    action: "payment.statement.reconciled",
    actionLabel: `Conciliou extrato com "${entry.description}"`,
    resource: entry.description,
    resourceId: entry.id,
    metadata: { transactionId: transaction.id, amountCents: transaction.amountCents },
  });

  return {
    ok: true,
    entryStatus: applied.status,
    entryId: entry.id,
    entryDescription: entry.description,
    amountCents: transaction.amountCents,
  };
}
