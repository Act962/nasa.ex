import "server-only";

import prisma from "@/lib/prisma";
import { resolveDashboardPeriod, type DashboardPeriodInput } from "../dashboard/load-dashboard";

// Fluxo de caixa como serviço (spec 0010). O que já foi liquidado entra pela
// data do pagamento; o que segue em aberto entra pelo vencimento.

const CASHFLOW_OPEN_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

export interface CashflowRow {
  date: string;
  receivable: number;
  payable: number;
  balance: number;
}

export interface CashflowDayEntry {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: string;
  description: string;
  amount: number;
  paidAmount: number;
  /** O valor que entrou na soma do dia: pago se liquidado, previsto se em aberto. */
  cashAmount: number;
  dueDate: Date;
  paidAt: Date | null;
  categoryName: string | null;
  contactName: string | null;
}

/**
 * O `where` que define o que entra no fluxo de caixa de um período. Vive numa
 * função para que o detalhe de um dia use exatamente a mesma regra do total.
 */
export function cashflowWhere(params: {
  organizationId: string;
  start: Date;
  end: Date;
  categoryIds?: string[];
}) {
  return {
    organizationId: params.organizationId,
    ...(params.categoryIds && params.categoryIds.length > 0
      ? { categoryId: { in: params.categoryIds } }
      : {}),
    OR: [
      { status: "PAID" as const, paidAt: { gte: params.start, lte: params.end } },
      {
        status: { in: [...CASHFLOW_OPEN_STATUSES] },
        dueDate: { gte: params.start, lte: params.end },
      },
    ],
  };
}

export async function loadCashflow(
  params: DashboardPeriodInput & { organizationId: string },
): Promise<{ rows: CashflowRow[]; period: { start: Date; end: Date } }> {
  const { start, end } = resolveDashboardPeriod(params);

  const entries = await prisma.paymentEntry.findMany({
    where: cashflowWhere({
      organizationId: params.organizationId,
      start,
      end,
      categoryIds: params.categoryIds,
    }),
    select: { type: true, amount: true, paidAmount: true, dueDate: true, paidAt: true, status: true },
  });

  const dayMap: Record<string, { receivable: number; payable: number }> = {};
  for (const entry of entries) {
    const isSettled = entry.status === "PAID";
    const cashDate = isSettled ? entry.paidAt ?? entry.dueDate : entry.dueDate;
    const key = cashDate.toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { receivable: 0, payable: 0 };
    const value = isSettled ? entry.paidAmount : entry.amount;
    if (entry.type === "RECEIVABLE") dayMap[key].receivable += value;
    else dayMap[key].payable += value;
  }

  let runningBalance = 0;
  const rows = Object.entries(dayMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, totals]) => {
      runningBalance += totals.receivable - totals.payable;
      return { date, receivable: totals.receivable, payable: totals.payable, balance: runningBalance };
    });

  return { rows, period: { start, end } };
}

export async function loadCashflowDayEntries(params: {
  organizationId: string;
  /** "2026-09-15" — a mesma chave que a linha da tabela carrega. */
  date: string;
  categoryIds?: string[];
}): Promise<{ entries: CashflowDayEntry[]; totals: { receivable: number; payable: number } }> {
  const [year, month, day] = params.date.split("-").map(Number);
  // A chave do dia é montada em UTC no `loadCashflow`; a janela precisa usar o
  // mesmo referencial para devolver exatamente as mesmas linhas.
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  const rows = await prisma.paymentEntry.findMany({
    where: cashflowWhere({
      organizationId: params.organizationId,
      start,
      end,
      categoryIds: params.categoryIds,
    }),
    select: {
      id: true,
      type: true,
      status: true,
      description: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      paidAt: true,
      category: { select: { name: true } },
      contact: { select: { name: true } },
    },
    orderBy: { amount: "desc" },
  });

  const entries: CashflowDayEntry[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    description: row.description,
    amount: row.amount,
    paidAmount: row.paidAmount,
    cashAmount: row.status === "PAID" ? row.paidAmount : row.amount,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    categoryName: row.category?.name ?? null,
    contactName: row.contact?.name ?? null,
  }));

  return {
    entries,
    totals: {
      receivable: entries
        .filter((entry) => entry.type === "RECEIVABLE")
        .reduce((sum, entry) => sum + entry.cashAmount, 0),
      payable: entries
        .filter((entry) => entry.type === "PAYABLE")
        .reduce((sum, entry) => sum + entry.cashAmount, 0),
    },
  };
}
