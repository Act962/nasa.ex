import "server-only";

import prisma from "@/lib/prisma";
import { statementFailure, type StatementFailure } from "./service-result";

// Tira uma transação da fila (tarifa, transferência entre contas próprias) ou
// devolve uma ignorada para a fila.

export async function loadIgnorableStatementTransaction(params: {
  organizationId: string;
  transactionId: string;
}) {
  const transaction = await prisma.paymentBankTransaction.findFirst({
    where: { id: params.transactionId, organizationId: params.organizationId },
    select: {
      id: true,
      status: true,
      memo: true,
      amountCents: true,
      direction: true,
      postedDate: true,
      ignoredReason: true,
    },
  });
  if (!transaction) return statementFailure("not_found", "Transação não encontrada");
  if (transaction.status === "MATCHED") {
    return statementFailure("invalid", "Desfaça a conciliação antes de ignorar");
  }
  return { ok: true as const, transaction };
}

export async function ignoreStatementTransactionRecord(params: {
  organizationId: string;
  transactionId: string;
  reason?: string | null;
  undo: boolean;
}): Promise<{ ok: true } | StatementFailure> {
  const loaded = await loadIgnorableStatementTransaction(params);
  if (!loaded.ok) return loaded;

  await prisma.paymentBankTransaction.update({
    where: { id: loaded.transaction.id },
    data: params.undo
      ? { status: "PENDING", ignoredReason: null }
      : { status: "IGNORED", ignoredReason: params.reason ?? null },
  });
  return { ok: true };
}
