import "server-only";

import prisma from "@/lib/prisma";

// DRE e DRO como serviço. "cash" = o que entrou/saiu de fato (por data de
// pagamento); "accrual" = competência, por data de vencimento.

export type ReportRegime = "cash" | "accrual";

export interface ReportInput {
  organizationId: string;
  dateFrom?: string;
  dateTo?: string;
  regime?: ReportRegime;
  categoryIds?: string[];
}

export interface ReportGroup {
  total: number;
  lines: Array<{ name: string; amount: number }>;
}

export interface IncomeStatement {
  revenue: ReportGroup;
  costs: ReportGroup;
  expenses: ReportGroup;
  grossProfit: number;
  grossMarginPercent: number;
  netResult: number;
  netMarginPercent: number;
  period: { start: Date; end: Date };
}

export interface OperationalResultRow {
  costCenterId: string | null;
  costCenterName: string;
  revenue: number;
  expenses: number;
  result: number;
  marginPercent: number;
}

export interface OperationalResult {
  rows: OperationalResultRow[];
  totals: { revenue: number; expenses: number; result: number; marginPercent: number };
  period: { start: Date; end: Date };
}

interface ReportEntry {
  type: "RECEIVABLE" | "PAYABLE";
  amount: number;
  paidAmount: number;
  category: { name: string; type: string } | null;
  costCenter: { id: string; name: string } | null;
}

export function resolveReportRange(dateFrom?: string, dateTo?: string) {
  const now = new Date();
  return {
    start: dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1),
    end: dateTo ? new Date(dateTo) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

async function loadReportEntries(params: {
  organizationId: string;
  regime: ReportRegime;
  start: Date;
  end: Date;
  categoryIds?: string[];
}): Promise<ReportEntry[]> {
  return prisma.paymentEntry.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.categoryIds && params.categoryIds.length > 0
        ? { categoryId: { in: params.categoryIds } }
        : {}),
      ...(params.regime === "cash"
        ? {
            status: { in: ["PAID", "PARTIAL"] },
            paidAt: { gte: params.start, lte: params.end },
          }
        : {
            status: { notIn: ["CANCELLED", "PENDING_APPROVAL"] },
            dueDate: { gte: params.start, lte: params.end },
          }),
    },
    select: {
      type: true,
      amount: true,
      paidAmount: true,
      category: { select: { name: true, type: true } },
      costCenter: { select: { id: true, name: true } },
    },
  });
}

function valueOf(entry: ReportEntry, regime: ReportRegime): number {
  return regime === "cash" ? entry.paidAmount : entry.amount;
}

function toSortedLines(totals: Map<string, number>) {
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

export async function loadIncomeStatement(input: ReportInput): Promise<IncomeStatement> {
  const regime = input.regime ?? "cash";
  const { start, end } = resolveReportRange(input.dateFrom, input.dateTo);
  const entries = await loadReportEntries({
    organizationId: input.organizationId,
    regime,
    start,
    end,
    categoryIds: input.categoryIds,
  });

  const revenueTotals = new Map<string, number>();
  const costTotals = new Map<string, number>();
  const expenseTotals = new Map<string, number>();

  for (const entry of entries) {
    const value = valueOf(entry, regime);
    if (value === 0) continue;

    const name = entry.category?.name ?? "Sem categoria";
    // Sem categoria, o tipo do lançamento decide o grupo: receber vira
    // receita, pagar vira despesa operacional.
    const group =
      entry.category?.type ?? (entry.type === "RECEIVABLE" ? "REVENUE" : "EXPENSE");

    const target =
      group === "REVENUE" ? revenueTotals : group === "COST" ? costTotals : expenseTotals;
    target.set(name, (target.get(name) ?? 0) + value);
  }

  const sumOf = (totals: Map<string, number>) =>
    [...totals.values()].reduce((sum, value) => sum + value, 0);

  const revenueTotal = sumOf(revenueTotals);
  const costTotal = sumOf(costTotals);
  const expenseTotal = sumOf(expenseTotals);
  const grossProfit = revenueTotal - costTotal;
  const netResult = grossProfit - expenseTotal;

  return {
    revenue: { total: revenueTotal, lines: toSortedLines(revenueTotals) },
    costs: { total: costTotal, lines: toSortedLines(costTotals) },
    expenses: { total: expenseTotal, lines: toSortedLines(expenseTotals) },
    grossProfit,
    grossMarginPercent: percentOf(grossProfit, revenueTotal),
    netResult,
    netMarginPercent: percentOf(netResult, revenueTotal),
    period: { start, end },
  };
}

export async function loadOperationalResult(input: ReportInput): Promise<OperationalResult> {
  const regime = input.regime ?? "cash";
  const { start, end } = resolveReportRange(input.dateFrom, input.dateTo);
  const entries = await loadReportEntries({
    organizationId: input.organizationId,
    regime,
    start,
    end,
    categoryIds: input.categoryIds,
  });

  const buckets = new Map<
    string,
    { costCenterId: string | null; costCenterName: string; revenue: number; expenses: number }
  >();

  for (const entry of entries) {
    const value = valueOf(entry, regime);
    if (value === 0) continue;

    const key = entry.costCenter?.id ?? "__none__";
    const bucket = buckets.get(key) ?? {
      costCenterId: entry.costCenter?.id ?? null,
      costCenterName: entry.costCenter?.name ?? "Sem centro de custo",
      revenue: 0,
      expenses: 0,
    };

    if (entry.type === "RECEIVABLE") bucket.revenue += value;
    else bucket.expenses += value;

    buckets.set(key, bucket);
  }

  const rows = [...buckets.values()]
    .map((bucket) => {
      const result = bucket.revenue - bucket.expenses;
      return { ...bucket, result, marginPercent: percentOf(result, bucket.revenue) };
    })
    .sort((left, right) => right.revenue - left.revenue);

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalExpenses = rows.reduce((sum, row) => sum + row.expenses, 0);
  const totalResult = totalRevenue - totalExpenses;

  return {
    rows,
    totals: {
      revenue: totalRevenue,
      expenses: totalExpenses,
      result: totalResult,
      marginPercent: percentOf(totalResult, totalRevenue),
    },
    period: { start, end },
  };
}
