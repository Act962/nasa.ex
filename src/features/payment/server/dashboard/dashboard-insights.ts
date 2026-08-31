// Consultas complementares do Painel Financeiro: comparativo com o período
// anterior, prévias de contas a receber/pagar, últimas transações e os
// contadores usados no Resumo Executivo.
import prisma from "@/lib/prisma";

const OPEN_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;
const PREVIEW_LIMIT = 5;
const RECENT_TRANSACTIONS_LIMIT = 6;

export type DashboardPeriod = { start: Date; end: Date };

export type PreviewEntry = {
  id: string;
  description: string;
  contactName: string | null;
  categoryName: string | null;
  amount: number;
  dueDate: Date;
  status: string;
};

export type RecentTransaction = {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  contactName: string | null;
  amount: number;
  occurredAt: Date;
};

export type PreviousPeriodTotals = {
  totalReceivable: number;
  totalPayable: number;
  totalPaid: number;
  netResult: number;
};

export type DashboardInsights = {
  previousPeriod: PreviousPeriodTotals;
  upcomingReceivables: PreviewEntry[];
  upcomingPayables: PreviewEntry[];
  recentTransactions: RecentTransaction[];
  paidReceivableCount: number;
  overdueReceivableInPeriod: number;
};

/** Janela imediatamente anterior, com a mesma duração do período selecionado. */
export function previousPeriodOf(period: DashboardPeriod): DashboardPeriod {
  const durationMs = Math.max(period.end.getTime() - period.start.getTime(), 0);
  const end = new Date(period.start.getTime() - 1);
  const start = new Date(end.getTime() - durationMs);
  return { start, end };
}

const previewSelect = {
  id: true,
  description: true,
  amount: true,
  dueDate: true,
  status: true,
  contact: { select: { name: true } },
  category: { select: { name: true } },
} as const;

type PreviewRow = {
  id: string;
  description: string;
  amount: number;
  dueDate: Date;
  status: string;
  contact: { name: string } | null;
  category: { name: string } | null;
};

function toPreviewEntry(row: PreviewRow): PreviewEntry {
  return {
    id: row.id,
    description: row.description,
    contactName: row.contact?.name ?? null,
    categoryName: row.category?.name ?? null,
    amount: row.amount,
    dueDate: row.dueDate,
    status: row.status,
  };
}

export async function loadDashboardInsights({
  organizationId,
  period,
}: {
  organizationId: string;
  period: DashboardPeriod;
}): Promise<DashboardInsights> {
  const previous = previousPeriodOf(period);

  const [
    previousReceivableAgg,
    previousPayableAgg,
    previousReceivedAgg,
    previousPaidAgg,
    upcomingReceivableRows,
    upcomingPayableRows,
    recentRows,
    paidReceivableCount,
    overdueInPeriodAgg,
  ] = await Promise.all([
    prisma.paymentEntry.aggregate({
      where: {
        organizationId,
        type: "RECEIVABLE",
        dueDate: { gte: previous.start, lte: previous.end },
        status: { in: [...OPEN_STATUSES] },
      },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: {
        organizationId,
        type: "PAYABLE",
        dueDate: { gte: previous.start, lte: previous.end },
        status: { in: [...OPEN_STATUSES] },
      },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: {
        organizationId,
        type: "RECEIVABLE",
        paidAt: { gte: previous.start, lte: previous.end },
        status: "PAID",
      },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: {
        organizationId,
        type: "PAYABLE",
        paidAt: { gte: previous.start, lte: previous.end },
        status: "PAID",
      },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.findMany({
      where: {
        organizationId,
        type: "RECEIVABLE",
        status: { in: [...OPEN_STATUSES] },
        dueDate: { gte: period.start, lte: period.end },
      },
      select: previewSelect,
      orderBy: { dueDate: "asc" },
      take: PREVIEW_LIMIT,
    }),
    prisma.paymentEntry.findMany({
      where: {
        organizationId,
        type: "PAYABLE",
        status: { in: [...OPEN_STATUSES] },
        dueDate: { gte: period.start, lte: period.end },
      },
      select: previewSelect,
      orderBy: { dueDate: "asc" },
      take: PREVIEW_LIMIT,
    }),
    prisma.paymentEntry.findMany({
      where: {
        organizationId,
        status: { in: ["PAID", "PARTIAL"] },
        paidAt: { not: null },
      },
      select: {
        id: true,
        type: true,
        description: true,
        paidAmount: true,
        paidAt: true,
        contact: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
      take: RECENT_TRANSACTIONS_LIMIT,
    }),
    prisma.paymentEntry.count({
      where: {
        organizationId,
        type: "RECEIVABLE",
        status: "PAID",
        paidAt: { gte: period.start, lte: period.end },
      },
    }),
    prisma.paymentEntry.aggregate({
      where: {
        organizationId,
        type: "RECEIVABLE",
        status: "OVERDUE",
        dueDate: { gte: period.start, lte: period.end },
      },
      _sum: { amount: true },
    }),
  ]);

  const previousReceived = previousReceivedAgg._sum.paidAmount ?? 0;
  const previousPaid = previousPaidAgg._sum.paidAmount ?? 0;

  return {
    previousPeriod: {
      totalReceivable: previousReceivableAgg._sum.amount ?? 0,
      totalPayable: previousPayableAgg._sum.amount ?? 0,
      totalPaid: previousPaid,
      netResult: previousReceived - previousPaid,
    },
    upcomingReceivables: upcomingReceivableRows.map(toPreviewEntry),
    upcomingPayables: upcomingPayableRows.map(toPreviewEntry),
    recentTransactions: recentRows.map((row) => ({
      id: row.id,
      type: row.type,
      description: row.description,
      contactName: row.contact?.name ?? null,
      amount: row.paidAmount,
      occurredAt: row.paidAt as Date,
    })),
    paidReceivableCount,
    overdueReceivableInPeriod: overdueInPeriodAgg._sum.amount ?? 0,
  };
}
