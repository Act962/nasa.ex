import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateCampaignEvent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      campaignId: z.string(),
      eventId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      scheduledAt: z.string().optional(),
      durationMinutes: z.number().optional(),
      meetingLink: z.string().optional(),
      status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED"]).optional(),
      participants: z.array(z.any()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { campaignId, eventId, scheduledAt, ...rest } = input;

    const event = await prisma.nasaCampaignEvent.findFirst({
      where: { id: eventId, campaignPlannerId: campaignId, campaignPlanner: { organizationId: context.org.id } },
    });
    if (!event) throw new Error("Evento não encontrado.");

    const updated = await prisma.nasaCampaignEvent.update({
      where: { id: eventId },
      data: {
        ...rest,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      },
    });

    return { event: updated };
  });
