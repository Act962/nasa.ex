import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { loadDashboardInsights } from "@/features/payment/server/dashboard/dashboard-insights";
import { z } from "zod";

const previewEntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  contactName: z.string().nullable(),
  categoryName: z.string().nullable(),
  amount: z.number(),
  dueDate: z.date(),
  status: z.string(),
});

const recentTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  description: z.string(),
  contactName: z.string().nullable(),
  amount: z.number(),
  occurredAt: z.date(),
});

export const getPaymentDashboard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Get payment dashboard summary", tags: ["Payment"] })
  .input(z.object({
    month: z.number().optional(),
    year: z.number().optional(),
    // Range explícito (ISO string). Tem precedência sobre month/year quando
    // ambos vêm — usado pelo PaymentPeriodPicker do frontend.
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    // Filtro compartilhado do módulo. Vazio/ausente = todas as categorias.
    categoryIds: z.array(z.string()).optional(),
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
    // Mesma janela imediatamente anterior — alimenta as variações "x% vs
    // período anterior" dos cards do topo.
    previousPeriod: z.object({
      totalReceivable: z.number(),
      totalPayable: z.number(),
      totalPaid: z.number(),
      netResult: z.number(),
    }),
    executive: z.object({
      revenue: z.number(),
      netProfit: z.number(),
      averageTicket: z.number(),
      defaultRatePercent: z.number(),
      overdueInPeriod: z.number(),
      reserves: z.number(),
      goalTarget: z.number(),
      goalAchieved: z.number(),
    }),
    upcomingReceivables: z.array(previewEntrySchema),
    upcomingPayables: z.array(previewEntrySchema),
    recentTransactions: z.array(recentTransactionSchema),
  }))
  .handler(async ({ input, context, errors }) => {
    try {
      const now = new Date();
      const year = input.year ?? now.getFullYear();
      const month = input.month ?? now.getMonth() + 1;
      // Se veio range explícito, usa ele; senão cai no cálculo por mês/ano.
      const monthStart = input.dateFrom
        ? new Date(input.dateFrom)
        : new Date(year, month - 1, 1);
      const monthEnd = input.dateTo
        ? new Date(input.dateTo)
        : new Date(year, month, 0, 23, 59, 59);
      const today = new Date();
      const in7 = new Date(today); in7.setDate(today.getDate() + 7);
      const in30 = new Date(today); in30.setDate(today.getDate() + 30);
      const orgId = context.org.id;
      // Espalhado em cada where de lançamento abaixo. Contas bancárias ficam
      // de fora de propósito: saldo de conta não pertence a categoria.
      const categoryFilter =
        input.categoryIds && input.categoryIds.length > 0
          ? { categoryId: { in: input.categoryIds } }
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
        // total a receber no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", dueDate: { gte: monthStart, lte: monthEnd }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          _sum: { amount: true },
        }),
        // total a pagar no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", dueDate: { gte: monthStart, lte: monthEnd }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          _sum: { amount: true },
        }),
        // total recebido no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // total pago no mês
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // inadimplente a receber
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", status: "OVERDUE", dueDate: { lt: today } },
          _sum: { amount: true },
        }),
        // inadimplente a pagar
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", status: "OVERDUE", dueDate: { lt: today } },
          _sum: { amount: true },
        }),
        // próximos 7 dias a receber
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in7 } },
          _sum: { amount: true },
        }),
        // próximos 7 dias a pagar
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in7 } },
          _sum: { amount: true },
        }),
        // próximos 30 dias a receber
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in30 } },
          _sum: { amount: true },
        }),
        // próximos 30 dias a pagar
        prisma.paymentEntry.aggregate({
          where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: in30 } },
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
          where: { organizationId: orgId, ...categoryFilter, type: "RECEIVABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // breakdown por categoria - despesas
        prisma.paymentEntry.groupBy({
          by: ["categoryId"],
          where: { organizationId: orgId, ...categoryFilter, type: "PAYABLE", paidAt: { gte: monthStart, lte: monthEnd }, status: "PAID" },
          _sum: { paidAmount: true },
        }),
        // últimos 6 meses
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
      const totalReceivable = receivableAgg._sum.amount ?? 0;

      // Previsto do período = o que já entrou + o que ainda está em aberto.
      // É a régua usada tanto no medidor de meta quanto na inadimplência.
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
      };
    } catch (err) {
      console.error("[payment/dashboard]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// Mesma definicao de "em aberto" do painel — os totais das duas telas
// precisam fechar entre si.
const CASHFLOW_OPEN_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

/**
 * O `where` que define o que entra no fluxo de caixa de um período.
 *
 * Vive numa função para que o detalhe de um dia use exatamente a mesma regra
 * do total daquele dia — se as duas divergissem, a lista abriria sem explicar
 * o número que a originou.
 */
function cashflowWhere(params: {
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

export const getCashflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Get cashflow", tags: ["Payment"] })
  .input(z.object({
    year: z.number().optional(),
    month: z.number().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
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
      const monthStart = input.dateFrom
        ? new Date(input.dateFrom)
        : new Date(year, month - 1, 1);
      const monthEnd = input.dateTo
        ? new Date(input.dateTo)
        : new Date(year, month, 0, 23, 59, 59);

      // O que já foi liquidado entra pela data do pagamento; o que segue em
      // aberto entra pelo vencimento. Filtrar tudo por `dueDate` fazia uma
      // despesa vencida num mês e paga no seguinte sumir do fluxo do mês em
      // que o dinheiro de fato saiu, embora contasse nos "Gastos do período".
      const entries = await prisma.paymentEntry.findMany({
        where: cashflowWhere({
          organizationId: context.org.id,
          start: monthStart,
          end: monthEnd,
          categoryIds: input.categoryIds,
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
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => {
          runningBalance += v.receivable - v.payable;
          return { date, receivable: v.receivable, payable: v.payable, balance: runningBalance };
        });

      return { rows };
    } catch (err) {
      console.error("[payment/dashboard/getCashflow]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

/**
 * Lançamentos que compõem um dia do fluxo de caixa.
 *
 * Usa `cashflowWhere` com a janela de um dia só — a mesma regra que produziu o
 * total da linha, então a soma da lista sempre reproduz o valor clicado.
 */
export const getCashflowDayEntries = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Entries behind a cashflow day", tags: ["Payment"] })
  .input(
    z.object({
      // "2026-09-15" — o mesmo `date` que a linha da tabela carrega.
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
      categoryIds: z.array(z.string()).optional(),
    }),
  )
  .output(
    z.object({
      entries: z.array(
        z.object({
          id: z.string(),
          type: z.enum(["RECEIVABLE", "PAYABLE"]),
          status: z.string(),
          description: z.string(),
          amount: z.number(),
          paidAmount: z.number(),
          /** O valor que entrou na soma do dia: pago se liquidado, previsto se em aberto. */
          cashAmount: z.number(),
          dueDate: z.date(),
          paidAt: z.date().nullable(),
          categoryName: z.string().nullable(),
          contactName: z.string().nullable(),
        }),
      ),
      totals: z.object({ receivable: z.number(), payable: z.number() }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const [year, month, day] = input.date.split("-").map(Number);
      // A chave do dia é montada em UTC no `getCashflow`; a janela precisa
      // usar o mesmo referencial para devolver exatamente as mesmas linhas.
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      const rows = await prisma.paymentEntry.findMany({
        where: cashflowWhere({
          organizationId: context.org.id,
          start,
          end,
          categoryIds: input.categoryIds,
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

      const entries = rows.map((row) => ({
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
    } catch (err) {
      console.error("[payment/dashboard/cashflow-day]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
