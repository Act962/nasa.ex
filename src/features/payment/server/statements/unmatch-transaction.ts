import "server-only";

import prisma from "@/lib/prisma";
import { revertPaymentFromEntry } from "./apply-payment";
import { statementFailure, type StatementFailure } from "./service-result";

// Desfaz a conciliação: estorna a baixa do lançamento e devolve a transação
// para a fila.

export async function loadMatchedStatementTransaction(params: {
  organizationId: string;
  transactionId: string;
}) {
  const transaction = await prisma.paymentBankTransaction.findFirst({
    where: { id: params.transactionId, organizationId: params.organizationId },
    include: { matchedEntry: { select: { id: true, description: true, type: true } } },
  });
  if (!transaction) return statementFailure("not_found", "Transação não encontrada");
  if (transaction.status !== "MATCHED" || !transaction.matchedEntryId) {
    return statementFailure("invalid", "Esta transação não está conciliada");
  }
  return { ok: true as const, transaction, matchedEntryId: transaction.matchedEntryId };
}

export async function unmatchStatementTransactionRecord(params: {
  organizationId: string;
  transactionId: string;
}): Promise<{ ok: true; entryId: string } | StatementFailure> {
  const loaded = await loadMatchedStatementTransaction(params);
  if (!loaded.ok) return loaded;
  const { transaction, matchedEntryId } = loaded;

  await prisma.$transaction(async (tx) => {
    await revertPaymentFromEntry(tx, {
      entryId: matchedEntryId,
      amountCents: transaction.amountCents,
    });
    await tx.paymentBankTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "PENDING",
        matchedEntryId: null,
        matchedAt: null,
        matchedById: null,
        matchMethod: null,
      },
    });
  });
  return { ok: true, entryId: matchedEntryId };
}
