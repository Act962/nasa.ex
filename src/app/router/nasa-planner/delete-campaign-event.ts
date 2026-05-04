import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteCampaignEvent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ campaignId: z.string(), eventId: z.string() }))
  .handler(async ({ input, context }) => {
    const event = await prisma.nasaCampaignEvent.findFirst({
      where: { id: input.eventId, campaignPlannerId: input.campaignId, campaignPlanner: { organizationId: context.org.id } },
      include: { campaignPlanner: { select: { title: true } } },
    });
    if (!event) throw new Error("Evento não encontrado.");
    await prisma.nasaCampaignEvent.delete({ where: { id: input.eventId } });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      subAppSlug: "nasa-planner-events",
      featureKey: "campaign.event.deleted",
      action: "campaign.event.deleted",
      actionLabel: `Excluiu o evento "${event.title}" da campanha "${event.campaignPlanner.title}"`,
      resource: event.title,
      resourceId: event.id,
      metadata: {
        campaignId: input.campaignId,
        campaignName: event.campaignPlanner.title,
      },
    });

    return { success: true };
  });
