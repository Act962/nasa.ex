import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { z } from "zod";
import {
  DEFAULT_TREND_WINDOW_MONTHS,
  loadPaymentProjection,
} from "@/features/payment/server/projection/load-projection";

// Projeção financeira (spec 0009). A procedure só valida e delega: a busca mora
// em `load-projection.ts` e o cálculo em `build-projection.ts`, puro (D-5).

export const getPaymentProjection = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Get financial projection", tags: ["Payment"] })
  .input(
    z.object({
      horizonMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]).default(6),
      trendWindowMonths: z.number().min(1).max(24).default(DEFAULT_TREND_WINDOW_MONTHS),
      // Filtro compartilhado do módulo. Afeta os lançamentos, não o saldo
      // inicial: conta bancária não pertence a categoria.
      categoryIds: z.array(z.string()).optional(),
    }),
  )
  .output(
    z.object({
      openingBalance: z.number(),
      accountsCount: z.number(),
      monthlyAverageIn: z.number(),
      monthlyAverageOut: z.number(),
      trendMonthsUsed: z.number(),
      hasTrendBasis: z.boolean(),
      overdueIn: z.number(),
      overdueOut: z.number(),
      months: z.array(
        z.object({
          month: z.string(),
          label: z.string(),
          committedIn: z.number(),
          committedOut: z.number(),
          estimatedIn: z.number(),
          estimatedOut: z.number(),
          overdueIn: z.number(),
          overdueOut: z.number(),
          projectedBalance: z.number(),
          confidence: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await loadPaymentProjection({
        organizationId: context.org.id,
        horizonMonths: input.horizonMonths,
        trendWindowMonths: input.trendWindowMonths,
        categoryIds: input.categoryIds,
      });
    } catch (err) {
      console.error("[payment/projection get]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
