import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { z } from "zod";
import { computeLeadsByTags } from "@/features/insights/lib/metrics/leads-by-tags";

export const getLeadsByTags = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/leads-by-tags",
    summary: "Get lead count grouped by tags for a tracking",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      tagIds: z.array(z.string()).optional(), // filtrar por tags específicas
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      /** Inclui tags arquivadas (soft-deleted) na lista. Default false —
       *  charts mostram só tags ativas pra não poluir. Toggle "Incluir
       *  arquivadas" no front liga isso pra análise histórica. */
      includeArchived: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      return await computeLeadsByTags({
        organizationId: org.id,
        trackingId: input.trackingId,
        tagIds: input.tagIds,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        includeArchived: input.includeArchived,
      });
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
