import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { loadPaymentDashboard } from "@/features/payment/server/dashboard/load-dashboard";
import {
  loadCashflow,
  loadCashflowDayEntries,
} from "@/features/payment/server/cashflow/load-cashflow";
import { z } from "zod";

// As procedures só validam e delegam: o cálculo mora nos serviços de
// `features/payment/server`, compartilhados com as tools do Astro (spec 0014).

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

const periodInput = z.object({
  month: z.number().optional(),
  year: z.number().optional(),
  // Range explícito (ISO string). Tem precedência sobre month/year quando
  // ambos vêm — usado pelo PaymentPeriodPicker do frontend.
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // Filtro compartilhado do módulo. Vazio/ausente = todas as categorias.
  categoryIds: z.array(z.string()).optional(),
});

export const getPaymentDashboard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Get payment dashboard summary", tags: ["Payment"] })
  .input(periodInput)
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
      const { period: _period, ...summary } = await loadPaymentDashboard({
        organizationId: context.org.id,
        ...input,
      });
      return summary;
    } catch (err) {
      console.error("[payment/dashboard]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const getCashflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Get cashflow", tags: ["Payment"] })
  .input(periodInput)
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
      const { rows } = await loadCashflow({ organizationId: context.org.id, ...input });
      return { rows };
    } catch (err) {
      console.error("[payment/dashboard/getCashflow]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

/**
 * Lançamentos que compõem um dia do fluxo de caixa — a mesma regra que produziu
 * o total da linha, então a soma da lista sempre reproduz o valor clicado.
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
      return await loadCashflowDayEntries({
        organizationId: context.org.id,
        date: input.date,
        categoryIds: input.categoryIds,
      });
    } catch (err) {
      console.error("[payment/dashboard/cashflow-day]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
