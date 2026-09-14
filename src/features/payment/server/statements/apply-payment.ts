import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Regra de quitação de um lançamento, compartilhada entre a baixa manual e a
 * conciliação bancária. Vive aqui porque duplicar a decisão de `PAID` vs
 * `PARTIAL` em dois lugares garante que um dia elas divirjam.
 *
 * Recebe o `tx` da transação: quem chama decide o escopo transacional.
 */

export interface ApplyPaymentInput {
  entryId: string;
  amountCents: number;
  paidAt: Date;
  accountId?: string | null;
}

export interface ApplyPaymentResult {
  paidAmount: number;
  status: "PAID" | "PARTIAL";
  outstanding: number;
}

export async function applyPaymentToEntry(
  tx: Prisma.TransactionClient,
  input: ApplyPaymentInput,
): Promise<ApplyPaymentResult> {
  const entry = await tx.paymentEntry.findUnique({
    where: { id: input.entryId },
    select: { amount: true, paidAmount: true, accountId: true, status: true },
  });
  if (!entry) throw new Error("Lançamento não encontrado");

  const paidAmount = entry.paidAmount + input.amountCents;
  const status = paidAmount >= entry.amount ? "PAID" : "PARTIAL";

  await tx.paymentEntry.update({
    where: { id: input.entryId },
    data: {
      paidAmount,
      status,
      paidAt: input.paidAt,
      // Só preenche a conta quando o lançamento não tinha uma: o extrato diz
      // por onde o dinheiro passou, mas não sobrepõe escolha do usuário.
      ...(entry.accountId || !input.accountId ? {} : { accountId: input.accountId }),
    },
  });

  return { paidAmount, status, outstanding: Math.max(entry.amount - paidAmount, 0) };
}

/** Desfaz uma quitação, devolvendo o lançamento ao estado em aberto. */
export async function revertPaymentFromEntry(
  tx: Prisma.TransactionClient,
  input: { entryId: string; amountCents: number },
): Promise<void> {
  const entry = await tx.paymentEntry.findUnique({
    where: { id: input.entryId },
    select: { amount: true, paidAmount: true, dueDate: true },
  });
  if (!entry) return;

  const paidAmount = Math.max(entry.paidAmount - input.amountCents, 0);
  const isOverdue = paidAmount === 0 && entry.dueDate.getTime() < Date.now();

  await tx.paymentEntry.update({
    where: { id: input.entryId },
    data: {
      paidAmount,
      status: paidAmount === 0 ? (isOverdue ? "OVERDUE" : "PENDING") : "PARTIAL",
      paidAt: paidAmount === 0 ? null : undefined,
    },
  });
}
