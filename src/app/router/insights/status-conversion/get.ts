import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../../middlewares/auth";
import { requireOrgMiddleware } from "../../../middlewares/org";
import { z } from "zod";
import { computeStatusConversion } from "@/features/insights/lib/metrics/status-conversion";

/**
 * Conversão por status no período. Dos leads criados na janela (cohort),
 * quantos passaram por cada status selecionado — contagem por status
 * VISITADO, não pelo status atual, então as linhas se sobrepõem de propósito.
 * `leadsInAnySelectedStatus` é a contagem distinta pra UI evitar somar errado.
 */
export const getStatusConversion = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/status-conversion",
    summary: "Conversão de leads por status no período",
  })
  .input(
    z.object({
      trackingId: z.string(),
      organizationIds: z.array(z.string()).optional(),
      /** Vazio = todos os status do tracking. */
      statusIds: z.array(z.string()).optional(),
      tagIds: z.array(z.string()).optional(),
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

    const result = await computeStatusConversion({
      organizationIds,
      trackingId: input.trackingId,
      statusIds: input.statusIds,
      tagIds: input.tagIds,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    });
    if (!result) throw errors.NOT_FOUND;

    return {
      ...result,
      period: {
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
      },
    };
  });
