import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";
import { recordLeadHistory } from "./utils/history";
import { logActivity } from "@/lib/activity-logger";

export const removeTagsFromLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    path: "/leads/remove-tags",
    method: "POST",
  })
  .input(
    z.object({
      leadId: z.string(),
      tagIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
    });

    if (!lead) {
      throw errors.UNAUTHORIZED;
    }

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.leadTag.deleteMany({
        where: {
          leadId: input.leadId,
          tagId: {
            in: input.tagIds,
          },
        },
      });

      await recordLeadHistory({
        leadId: input.leadId,
        userId: context.user.id,
        action: lead.currentAction,
        notes: "Tags removidas do lead",
        tx,
      });

      return deleted;
    });

    const tracking = await prisma.tracking.findUnique({
      where: { id: lead.trackingId },
      select: { organizationId: true, name: true },
    });
    if (tracking) {
      await logActivity({
        organizationId: tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        subAppSlug: "tracking-pipeline",
        featureKey: "lead.tag.removed",
        action: "lead.tag.removed",
        actionLabel: `Removeu ${result.count} tag(s) do lead "${lead.name}"`,
        resource: lead.name,
        resourceId: lead.id,
        metadata: {
          trackingName: tracking.name,
          tagIds: input.tagIds,
          count: result.count,
        },
      });
    }

    return {
      count: result.count,
    };
  });
