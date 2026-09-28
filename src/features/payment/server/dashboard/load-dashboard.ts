import "server-only";

import prisma from "@/lib/prisma";
import { loadDashboardInsights } from "./dashboard-insights";

// O Painel financeiro como serviço: a procedure `payment.dashboard.get` e as
// tools do Astro chamam a mesma função, então respondem os mesmos números.

export interface DashboardPeriodInput {
  month?: number;
  year?: number;
  /** Range explícito (ISO). Tem precedência sobre month/year. */
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
}

export interface DashboardPreviewEntry {
  id: string;
  description: string;
  contactName: string | null;
  categoryName: string | null;
  amount: number;
  dueDate: Date;
  status: string;
}

export interface DashboardRecentTransaction {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  contactName: string | null;
  amount: number;
  occurredAt: Date;
}

export interface PaymentDashboardSummary {
  totalReceivable: number;
  totalPayable: number;
  totalReceived: number;
  totalPaid: number;
  overdueReceivable: number;
  overduePayable: number;
  balanceTotal: number;
  netResult: number;
  upcoming7Days: { receivable: number; payable: number };
  upcoming30Days: { receivable: number; payable: number };
  monthlyChart: Array<{ month: string; receivable: number; payable: number; result: number }>;
  categoryBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    type: string;
    total: number;
  }>;
  previousPeriod: {
    totalReceivable: number;
    totalPayable: number;
    totalPaid: number;
    netResult: number;
  };
  executive: {
    revenue: number;
    netProfit: number;
    averageTicket: number;
    defaultRatePercent: number;
    overdueInPeriod: number;
    reserves: number;
    goalTarget: number;
    goalAchieved: number;
  };
  upcomingReceivables: DashboardPreviewEntry[];
  upcomingPayables: DashboardPreviewEntry[];
  recentTransactions: DashboardRecentTransaction[];
  period: { start: Date; end: Date };
}

export function resolveDashboardPeriod(input: DashboardPeriodInput): {
  start: Date;
  end: Date;
  year: number;
  month: number;
} {
  const now = new Date();
  const year = input.year ?? now.getFullYear();
  const month = input.month ?? now.getMonth() + 1;
  const start = input.dateFrom ? new Date(input.dateFrom) : new Date(year, month - 1, 1);
  const end = input.dateTo ? new Date(input.dateTo) : new Date(year, month, 0, 23, 59, 59);
  return { start, end, year, month };
}

export async function loadPaymentDashboard(
  params: DashboardPeriodInput & { organizationId: string },
): Promise<PaymentDashboardSummary> {
  const { organizationId: orgId } = params;
  const { start: monthStart, end: monthEnd, year, month } = resolveDashboardPeriod(params);
  const today = new Date();
  const in7 = new Date(today);
  in7.setDate(today.getDate() + 7);
  const in30 = new Date(today);
  in30.setDate(today.getDate() + 30);
  // Espalhado em cada where de lançamento abaixo. Contas bancárias ficam de
  // fora de propósito: saldo de conta não pertence a categoria.
  const categoryFilter =
    params.categoryIds && params.categoryIds.length > 0
      ? { categoryId: { in: params.categoryIds } }
      : {};

  const [
    receivableAgg,
    payableAgg,
    receivedAgg,
    paidAgg,
    overdueRec,
    overduePay,
    up7Rec,
    up7Pay,
    up30Rec,
    up30Pay,
    accounts,
    categoriesRec,
    categoriesPay,
    monthlyEntries,
    insights,
  ] = await Promise.all([
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", dueDate: { gte: monthStart, lte: monthEnd }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", dueDate: { gte: monthStart, lte: monthEnd }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", status: "OVERDUE", dueDate: { lt: today } },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", status: "OVERDUE", dueDate: { lt: today } },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in7 } },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in7 } },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in30 } },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in30 } },
      _sum: { amount: true },
    }),
    prisma.paymentBankAccount.aggregate({
      where: { organizationId: orgId, isActive: true },
      _sum: { balance: true },
    }),
    prisma.paymentEntry.groupBy({
      by: ["categoryId"],
      where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.groupBy({
      by: ["categoryId"],
      where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.findMany({
      where: {
        organizationId: orgId,
        ...categoryFilter,
        status: "PAID",
        paidAt: { gte: new Date(year, month - 7, 1), lte: monthEnd },
      },
      select: { type: true, paidAmount: true, paidAt: true },
    }),
    loadDashboardInsights({
      organizationId: orgId,
      period: { start: monthStart, end: monthEnd },
    }),
  ]);

  const categoryIdsToName = [
    ...categoriesRec.map((group) => group.categoryId),
    ...categoriesPay.map((group) => group.categoryId),
  ].filter((id): id is string => Boolean(id));

  const categoryNameById = categoryIdsToName.length
    ? Object.fromEntries(
        (
          await prisma.paymentCategory.findMany({
            where: { id: { in: categoryIdsToName } },
            select: { id: true, name: true, type: true },
          })
        ).map((category) => [category.id, category]),
      )
    : {};

  const nameOf = (categoryId: string | null) =>
    categoryId ? categoryNameById[categoryId]?.name ?? "Sem categoria" : "Sem categoria";

  const categoryBreakdown = [
    ...categoriesRec.map((group) => ({
      categoryId: group.categoryId,
      categoryName: nameOf(group.categoryId),
      type: "RECEIVABLE",
      total: group._sum.paidAmount ?? 0,
    })),
    ...categoriesPay.map((group) => ({
      categoryId: group.categoryId,
      categoryName: nameOf(group.categoryId),
      type: "PAYABLE",
      total: group._sum.paidAmount ?? 0,
    })),
  ];

  const monthlyMap: Record<string, { receivable: number; payable: number }> = {};
  for (const entry of monthlyEntries) {
    if (!entry.paidAt) continue;
    const key = `${entry.paidAt.getFullYear()}-${String(entry.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) monthlyMap[key] = { receivable: 0, payable: 0 };
    if (entry.type === "RECEIVABLE") monthlyMap[key].receivable += entry.paidAmount;
    else monthlyMap[key].payable += entry.paidAmount;
  }
  const monthlyChart = Object.entries(monthlyMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([monthKey, totals]) => ({
      month: monthKey,
      receivable: totals.receivable,
      payable: totals.payable,
      result: totals.receivable - totals.payable,
    }));

  const totalReceived = receivedAgg._sum.paidAmount ?? 0;
  const totalPaid = paidAgg._sum.paidAmount ?? 0;
  const totalReceivable = receivableAgg._sum.amount ?? 0;

  // Previsto do período = o que já entrou + o que ainda está em aberto.
  const expectedRevenue = totalReceived + totalReceivable;
  const executive = {
    revenue: totalReceived,
    netProfit: totalReceived - totalPaid,
    averageTicket: insights.paidReceivableCount
      ? Math.round(totalReceived / insights.paidReceivableCount)
      : 0,
    defaultRatePercent: expectedRevenue
      ? (insights.overdueReceivableInPeriod / expectedRevenue) * 100
      : 0,
    overdueInPeriod: insights.overdueReceivableInPeriod,
    reserves: accounts._sum.balance ?? 0,
    goalTarget: expectedRevenue,
    goalAchieved: totalReceived,
  };

  return {
    totalReceivable,
    totalPayable: payableAgg._sum.amount ?? 0,
    totalReceived,
    totalPaid,
    overdueReceivable: overdueRec._sum.amount ?? 0,
    overduePayable: overduePay._sum.amount ?? 0,
    balanceTotal: accounts._sum.balance ?? 0,
    netResult: totalReceived - totalPaid,
    upcoming7Days: { receivable: up7Rec._sum.amount ?? 0, payable: up7Pay._sum.amount ?? 0 },
    upcoming30Days: { receivable: up30Rec._sum.amount ?? 0, payable: up30Pay._sum.amount ?? 0 },
    monthlyChart,
    categoryBreakdown,
    previousPeriod: insights.previousPeriod,
    executive,
    upcomingReceivables: insights.upcomingReceivables,
    upcomingPayables: insights.upcomingPayables,
    recentTransactions: insights.recentTransactions,
    period: { start: monthStart, end: monthEnd },
  };
}
