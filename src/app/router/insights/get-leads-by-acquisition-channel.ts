import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { z } from "zod";
import { computeAcquisitionChannels } from "@/features/insights/lib/metrics/acquisition-channels";

export const getLeadsByAcquisitionChannel = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/acquisition-channels",
    summary: "Get lead count grouped by acquisition source (channel)",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      return await computeAcquisitionChannels({
        organizationId: org.id,
        trackingId: input.trackingId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
