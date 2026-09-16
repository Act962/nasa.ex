import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { z } from "zod";
import {
  loadIncomeStatement,
  loadOperationalResult,
} from "@/features/payment/server/reports/load-reports";

// DRE e DRO: as procedures só validam e delegam para `load-reports.ts`, que o
// Astro também usa (spec 0014).

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
      const { period: _period, ...statement } = await loadIncomeStatement({
        organizationId: context.org.id,
        ...input,
      });
      return statement;
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
      const { period: _period, ...result } = await loadOperationalResult({
        organizationId: context.org.id,
        ...input,
      });
      return result;
    } catch (err) {
      console.error("[payment/reports/dro]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
