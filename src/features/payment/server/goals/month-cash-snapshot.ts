import "server-only";

import prisma from "@/lib/prisma";

/**
 * Os quatro agregados de caixa de um mês, num só lugar.
 *
 * O Painel, o card de metas e os crons de alerta leem daqui — se cada um
 * montasse o próprio `where`, voltaríamos ao problema da spec 0010, em que
 * duas telas respondiam números diferentes para a mesma pergunta.
 */

export const OPEN_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

export interface MonthCashSnapshot {
  /** Recebido de fato no mês (`RECEIVABLE` + `PAID`, por `paidAt`). */
  receivedRevenue: number;
  /** A receber ainda em aberto, por vencimento no mês. */
  openReceivable: number;
  /** Pago de fato no mês (`PAYABLE` + `PAID`, por `paidAt`). */
  paidExpense: number;
  /** A pagar ainda em aberto, por vencimento no mês. */
  openPayable: number;
}

export interface MonthCashParams {
  organizationId: string;
  period: { start: Date; end: Date };
  categoryIds?: string[];
}

export async function loadMonthCashSnapshot(
  params: MonthCashParams,
): Promise<MonthCashSnapshot> {
  const { organizationId, period, categoryIds } = params;
  const categoryFilter =
    categoryIds && categoryIds.length > 0
      ? { categoryId: { in: categoryIds } }
      : {};
  const settledWindow = { paidAt: { gte: period.start, lte: period.end } };
  const openWindow = {
    status: { in: [...OPEN_STATUSES] },
    dueDate: { gte: period.start, lte: period.end },
  };

  const [received, openReceivable, paid, openPayable] = await Promise.all([
    prisma.paymentEntry.aggregate({
      where: { organizationId, ...categoryFilter, type: "RECEIVABLE", status: "PAID", ...settledWindow },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId, ...categoryFilter, type: "RECEIVABLE", ...openWindow },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId, ...categoryFilter, type: "PAYABLE", status: "PAID", ...settledWindow },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId, ...categoryFilter, type: "PAYABLE", ...openWindow },
      _sum: { amount: true },
    }),
  ]);

  return {
    receivedRevenue: received._sum.paidAmount ?? 0,
    openReceivable: openReceivable._sum.amount ?? 0,
    paidExpense: paid._sum.paidAmount ?? 0,
    openPayable: openPayable._sum.amount ?? 0,
  };
}

/** Receita do mês fechado: o que já entrou mais o que ainda deve entrar. */
export function projectedRevenueOf(snapshot: MonthCashSnapshot): number {
  return snapshot.receivedRevenue + snapshot.openReceivable;
}

/** Despesa do mês fechado: o que já saiu mais o que ainda vence. */
export function projectedExpenseOf(snapshot: MonthCashSnapshot): number {
  return snapshot.paidExpense + snapshot.openPayable;
}

/** Caixa que sobra se todo o previsto do mês se confirmar. */
export function projectedCashOf(snapshot: MonthCashSnapshot): number {
  return projectedRevenueOf(snapshot) - projectedExpenseOf(snapshot);
}
