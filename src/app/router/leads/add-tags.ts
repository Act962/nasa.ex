import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { addLeadTagsRecord } from "@/features/leads/server/lead-commands";
import {
  areTagsInOrganization,
  isTrackingParticipant,
} from "@/features/leads/lib/tracking-participant-guard";

export const addTagsToLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    path: "/leads/add-tags",
    method: "POST",
  })
  .input(
    z.object({
      leadId: z.string(),
      tagIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: { trackingId: true, tracking: { select: { organizationId: true } } },
    });
    if (
      !lead ||
      !(await isTrackingParticipant(lead.trackingId, context.user.id)) ||
      !(await areTagsInOrganization(input.tagIds, lead.tracking.organizationId))
    ) {
      throw errors.NOT_FOUND;
    }

    return addLeadTagsRecord({ actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      }, leadId: input.leadId, tagIds: input.tagIds });
  });
