import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../../middlewares/auth";
import { requireOrgMiddleware } from "../../../middlewares/org";
import { z } from "zod";
import { computeFunnel } from "@/features/insights/lib/metrics/funnel";

/**
 * Funil visual de leads por etapa do tracking. Retorna lista ordenada por
 * `Status.order` com:
 *  - count: leads atualmente nessa etapa
 *  - avgTimeInStage: tempo médio (horas) que os leads passaram na etapa
 *    (calculado via `lastStatusChangeAt` para os leads atualmente nela)
 *  - dropoffFromPrevious: % de queda em relação à etapa anterior (decimal 0-100)
 */
export const getFunnel = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/funnel",
    summary: "Funil visual de leads por etapa do tracking",
  })
  .input(
    z.object({
      trackingId: z.string(),
      organizationIds: z.array(z.string()).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;
    const organizationIds =
      input.organizationIds && input.organizationIds.length > 0
        ? input.organizationIds
        : [org.id];

    const result = await computeFunnel({
      organizationIds,
      trackingId: input.trackingId,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    });
    if (!result) throw errors.NOT_FOUND;
    return result;
  });
