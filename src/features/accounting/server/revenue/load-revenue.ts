import "server-only";

import prisma from "@/lib/prisma";
import { shiftMonthKey, toMonthKey } from "@/features/accounting/lib/format";
import { computeRbt12 } from "@/features/accounting/lib/tax/simples/compute-rbt12";

// Receita bruta por competência: RECEIVABLE não cancelado, pela data de
// competência (ou vencimento, quando ela não foi informada).

export async function loadRevenueByMonth(params: {
  organizationId: string;
  fromMonth: string;
  toMonth: string;
}): Promise<Record<string, number>> {
  const fromDate = new Date(`${params.fromMonth}-01T00:00:00Z`);
  const toDate = new Date(`${shiftMonthKey(params.toMonth, 1)}-01T00:00:00Z`);

  const entries = await prisma.paymentEntry.findMany({
    where: {
      organizationId: params.organizationId,
      type: "RECEIVABLE",
      status: { notIn: ["CANCELLED", "PENDING_APPROVAL"] },
      OR: [
        { competenceDate: { gte: fromDate, lt: toDate } },
        { competenceDate: null, dueDate: { gte: fromDate, lt: toDate } },
      ],
    },
    select: { amount: true, competenceDate: true, dueDate: true },
  });

  const revenueByMonth: Record<string, number> = {};
  for (const entry of entries) {
    const monthKey = toMonthKey(entry.competenceDate ?? entry.dueDate);
    revenueByMonth[monthKey] = (revenueByMonth[monthKey] ?? 0) + entry.amount;
  }
  return revenueByMonth;
}

export async function loadRbt12(params: {
  organizationId: string;
  periodMonth: string;
  openedAt: Date | null;
}) {
  const revenueByMonth = await loadRevenueByMonth({
    organizationId: params.organizationId,
    fromMonth: shiftMonthKey(params.periodMonth, -12),
    toMonth: params.periodMonth,
  });
  const rbt12 = computeRbt12({
    periodMonth: params.periodMonth,
    revenueByMonth,
    openedMonth: params.openedAt ? toMonthKey(params.openedAt) : null,
  });
  return { ...rbt12, revenueByMonth, monthRevenueCents: revenueByMonth[params.periodMonth] ?? 0 };
}
