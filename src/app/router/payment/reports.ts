import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";

const regimeSchema = z.enum(["cash", "accrual"]).default("cash");

const reportInput = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // "cash" = o que entrou/saiu de fato (por data de pagamento).
  // "accrual" = competência, por data de vencimento.
  regime: regimeSchema,
  // Filtro compartilhado do módulo. Vazio/ausente = todas as categorias.
  categoryIds: z.array(z.string()).optional(),
});

const groupLineSchema = z.object({
  name: z.string(),
  amount: z.number(),
});

type Regime = "cash" | "accrual";

type ReportEntry = {
  type: "RECEIVABLE" | "PAYABLE";
  amount: number;
  paidAmount: number;
  category: { name: string; type: string } | null;
  costCenter: { id: string; name: string } | null;
};

function resolveRange(dateFrom?: string, dateTo?: string) {
  const now = new Date();
  return {
    start: dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth(), 1),
    end: dateTo
      ? new Date(dateTo)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

async function loadReportEntries({
  organizationId,
  regime,
  start,
  end,
  categoryIds,
}: {
  organizationId: string;
  regime: Regime;
  start: Date;
  end: Date;
  categoryIds?: string[];
}): Promise<ReportEntry[]> {
  return prisma.paymentEntry.findMany({
    where: {
      organizationId,
      ...(categoryIds && categoryIds.length > 0
        ? { categoryId: { in: categoryIds } }
        : {}),
      ...(regime === "cash"
        ? {
            status: { in: ["PAID", "PARTIAL"] },
            paidAt: { gte: start, lte: end },
          }
        : {
            status: { notIn: ["CANCELLED", "PENDING_APPROVAL"] },
            dueDate: { gte: start, lte: end },
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

function valueOf(entry: ReportEntry, regime: Regime): number {
  return regime === "cash" ? entry.paidAmount : entry.amount;
}

function toSortedLines(totals: Map<string, number>) {
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

export const getIncomeStatement = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "DRE — resultado do exercício", tags: ["Payment"] })
  .input(reportInput)
  .output(
    z.object({
      revenue: z.object({ total: z.number(), lines: z.array(groupLineSchema) }),
      costs: z.object({ total: z.number(), lines: z.array(groupLineSchema) }),
      expenses: z.object({ total: z.number(), lines: z.array(groupLineSchema) }),
      grossProfit: z.number(),
      grossMarginPercent: z.number(),
      netResult: z.number(),
      netMarginPercent: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { start, end } = resolveRange(input.dateFrom, input.dateTo);
      const entries = await loadReportEntries({
        organizationId: context.org.id,
        regime: input.regime,
        start,
        end,
        categoryIds: input.categoryIds,
      });

      const revenueTotals = new Map<string, number>();
      const costTotals = new Map<string, number>();
      const expenseTotals = new Map<string, number>();

      for (const entry of entries) {
        const value = valueOf(entry, input.regime);
        if (value === 0) continue;

        const name = entry.category?.name ?? "Sem categoria";
        // Sem categoria, o tipo do lançamento decide o grupo: receber vira
        // receita, pagar vira despesa operacional.
        const group =
          entry.category?.type ??
          (entry.type === "RECEIVABLE" ? "REVENUE" : "EXPENSE");

        const target =
          group === "REVENUE"
            ? revenueTotals
            : group === "COST"
              ? costTotals
              : expenseTotals;

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
      };
    } catch (err) {
      console.error("[payment/reports/dre]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const getOperationalResult = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "DRO — resultado por centro de custo", tags: ["Payment"] })
  .input(reportInput)
  .output(
    z.object({
      rows: z.array(
        z.object({
          costCenterId: z.string().nullable(),
          costCenterName: z.string(),
          revenue: z.number(),
          expenses: z.number(),
          result: z.number(),
          marginPercent: z.number(),
        }),
      ),
      totals: z.object({
        revenue: z.number(),
        expenses: z.number(),
        result: z.number(),
        marginPercent: z.number(),
      }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { start, end } = resolveRange(input.dateFrom, input.dateTo);
      const entries = await loadReportEntries({
        organizationId: context.org.id,
        regime: input.regime,
        start,
        end,
        categoryIds: input.categoryIds,
      });

      const buckets = new Map<
        string,
        { costCenterId: string | null; costCenterName: string; revenue: number; expenses: number }
      >();

      for (const entry of entries) {
        const value = valueOf(entry, input.regime);
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
          return {
            ...bucket,
            result,
            marginPercent: percentOf(result, bucket.revenue),
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

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
      };
    } catch (err) {
      console.error("[payment/reports/dro]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
