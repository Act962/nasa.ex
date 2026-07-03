import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { z } from "zod";
import { computeSoldThisMonth } from "@/features/insights/lib/metrics/sold-this-month";

export const getSoldThisMonth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/sold-this-month",
    summary: "Get leads won this month vs last month with daily breakdown",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      // Permite passar um mês de referência; padrão = mês atual
      referenceMonth: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(), // formato: "2024-03"
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      return await computeSoldThisMonth({
        organizationId: org.id,
        trackingId: input.trackingId,
        referenceMonth: input.referenceMonth,
      });
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
