import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getPaymentDashboard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get payment dashboard summary", tags: ["Payment"] })
  .input(z.object({
    month: z.number().optional(),
    year: z.number().optional(),
  }))
  .output(z.object({
    totalReceivable: z.number(),
    totalPayable: z.number(),
    totalReceived: z.number(),
    totalPaid: z.number(),
    overdueReceivable: z.number(),
    overduePayable: z.number(),
    balanceTotal: z.number(),
    netResult: z.number(),
    upcoming7Days: z.object({ receivable: z.number(), payable: z.number() }),
    upcoming30Days: z.object({ receivable: z.number(), payable: z.number() }),
    monthlyChart: z.array(z.object({
      month: z.string(),
      receivable: z.number(),
      payable: z.number(),
      result: z.number(),
    })),
    categoryBreakdown: z.array(z.object({
      categoryId: z.string().nullable(),
      categoryName: z.string(),
      type: z.string(),
      total: z.number(),
    })),
  }))
  .handler(async ({ input, context, errors }) => {
    try {
      const now = new Date();
      const year = input.year ?? now.getFullYear();
      const month = input.month ?? now.getMonth() + 1;
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      const today = new Date();
      const in7 = new Date(today); in7.setDate(today.getDate() + 7);
      const in30 = new Date(today); in30.setDate(today.getDate() + 30);
      const orgId = context.org.id;

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
      ] = await Promise.all([
        // total a receber no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "RECEIVABLE", dueDate: { gte: monthStart, lte: monthEnd }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          _sum: { amount: true },
        }),
        // total a pagar no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "PAYABLE", dueDate: { gte: monthStart, lte: monthEnd }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          _sum: { amount: true },
        }),
        // total recebido no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "RECEIVABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // total pago no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "PAYABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // inadimplente a receber
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "RECEIVABLE", status: "OVERDUE", dueDate: { lt: today } },
          _sum: { amount: true },
        }),
        // inadimplente a pagar
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "PAYABLE", status: "OVERDUE", dueDate: { lt: today } },
          _sum: { amount: true },
        }),
        // próximos 7 dias a receber
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "RECEIVABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in7 } },
          _sum: { amount: true },
        }),
        // próximos 7 dias a pagar
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "PAYABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in7 } },
          _sum: { amount: true },
        }),
        // próximos 30 dias a receber
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "RECEIVABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in30 } },
          _sum: { amount: true },
        }),
        // próximos 30 dias a pagar
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, type: "PAYABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in30 } },
          _sum: { amount: true },
        }),
        // saldo das contas
        prisma.paymentBankAccount.aggregate({
          where: { organizationId: orgId, isActive: true },
          _sum: { balance: true },
        }),
        // breakdown por categoria - receitas
        prisma.paymentEntry.groupBy({
          by: ["categoryId"],
          where: { organizationId: orgId, type: "RECEIVABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // breakdown por categoria - despesas
        prisma.paymentEntry.groupBy({
          by: ["categoryId"],
          where: { organizationId: orgId, type: "PAYABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // últimos 6 meses
        prisma.paymentEntry.findMany({
          where: {
            organizationId: orgId,
            status: "PAID",
            paidAt: { gte: new Date(year, month - 7, 1), lte: monthEnd },
          },
          select: { type: true, paidAmount: true, paidAt: true },
        }),
      ]);

      // Category names
      const catIds = [
        ...categoriesRec.map(c => c.categoryId),
        ...categoriesPay.map(c => c.categoryId),
      ].filter(Boolean) as string[];

      const catMap = catIds.length
        ? Object.fromEntries(
            (await prisma.paymentCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true, type: true } }))
              .map(c => [c.id, c])
          )
        : {};

      const categoryBreakdown = [
        ...categoriesRec.map(c => ({
          categoryId: c.categoryId,
          categoryName: c.categoryId ? catMap[c.categoryId]?.name ?? "Sem categoria" : "Sem categoria",
          type: "RECEIVABLE",
          total: c._sum.paidAmount ?? 0,
        })),
        ...categoriesPay.map(c => ({
          categoryId: c.categoryId,
          categoryName: c.categoryId ? catMap[c.categoryId]?.name ?? "Sem categoria" : "Sem categoria",
          type: "PAYABLE",
          total: c._sum.paidAmount ?? 0,
        })),
      ];

      // Monthly chart (last 6 months)
      const monthlyMap: Record<string, { receivable: number; payable: number }> = {};
      for (const e of monthlyEntries) {
        if (!e.paidAt) continue;
        const key = `${e.paidAt.getFullYear()}-${String(e.paidAt.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap[key]) monthlyMap[key] = { receivable: 0, payable: 0 };
        if (e.type === "RECEIVABLE") monthlyMap[key].receivable += e.paidAmount;
        else monthlyMap[key].payable += e.paidAmount;
      }
      const monthlyChart = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, v]) => ({ month: m, receivable: v.receivable, payable: v.payable, result: v.receivable - v.payable }));

      const totalReceived = receivedAgg._sum.paidAmount ?? 0;
      const totalPaid = paidAgg._sum.paidAmount ?? 0;

      return {
        totalReceivable: receivableAgg._sum.amount ?? 0,
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
      };
    } catch (err) {
      console.error("[payment/dashboard]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const getCashflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get cashflow", tags: ["Payment"] })
  .input(z.object({
    year: z.number().optional(),
    month: z.number().optional(),
  }))
  .output(z.object({
    rows: z.array(z.object({
      date: z.string(),
      receivable: z.number(),
      payable: z.number(),
      balance: z.number(),
    })),
  }))
  .handler(async ({ input, context, errors }) => {
    try {
      const now = new Date();
      const year = input.year ?? now.getFullYear();
      const month = input.month ?? now.getMonth() + 1;
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);

      const entries = await prisma.paymentEntry.findMany({
        where: {
          organizationId: context.org.id,
          status: { notIn: ["CANCELLED"] },
          dueDate: { gte: monthStart, lte: monthEnd },
        },
        select: { type: true, amount: true, paidAmount: true, dueDate: true, status: true },
        orderBy: { dueDate: "asc" },
      });

      const dayMap: Record<string, { receivable: number; payable: number }> = {};
      for (const e of entries) {
        const key = e.dueDate.toISOString().slice(0, 10);
        if (!dayMap[key]) dayMap[key] = { receivable: 0, payable: 0 };
        const val = e.status === "PAID" ? e.paidAmount : e.amount;
        if (e.type === "RECEIVABLE") dayMap[key].receivable += val;
        else dayMap[key].payable += val;
      }

      let runningBalance = 0;
      const rows = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => {
          runningBalance += v.receivable - v.payable;
          return { date, receivable: v.receivable, payable: v.payable, balance: runningBalance };
        });

      return { rows };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
