import "server-only";

import prisma from "@/lib/prisma";

// Saldo de conta derivado das baixas (spec 0023). `PaymentBankAccount.balance` é
// o saldo inicial digitado e alimenta a abertura da projeção (spec 0009); quem
// quiser o saldo de hoje soma as baixas por cima, sem sobrescrever o inicial.

export interface AccountSettledMovements {
  settledIn: number;
  settledOut: number;
}

export type SettledMovementsByAccount = Record<string, AccountSettledMovements>;

/**
 * Uma agregação só para todas as contas da org — uma query por conta derrubaria
 * a tela de quem tem muitos lançamentos.
 */
export async function loadSettledMovementsByAccount(
  organizationId: string,
): Promise<SettledMovementsByAccount> {
  const groups = await prisma.paymentEntry.groupBy({
    by: ["accountId", "type"],
    where: {
      organizationId,
      accountId: { not: null },
      status: { not: "CANCELLED" },
      paidAmount: { gt: 0 },
    },
    _sum: { paidAmount: true },
  });

  const byAccount: SettledMovementsByAccount = {};
  for (const group of groups) {
    if (!group.accountId) continue;
    if (!byAccount[group.accountId]) byAccount[group.accountId] = { settledIn: 0, settledOut: 0 };
    const total = group._sum.paidAmount ?? 0;
    if (group.type === "RECEIVABLE") byAccount[group.accountId].settledIn += total;
    else byAccount[group.accountId].settledOut += total;
  }
  return byAccount;
}

export function withComputedBalance<T extends { id: string; balance: number }>(
  account: T,
  movements: SettledMovementsByAccount,
): T & AccountSettledMovements & { computedBalance: number } {
  const { settledIn, settledOut } = movements[account.id] ?? { settledIn: 0, settledOut: 0 };
  return {
    ...account,
    settledIn,
    settledOut,
    computedBalance: account.balance + settledIn - settledOut,
  };
}
