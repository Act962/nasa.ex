import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { awardPoints } from "@/app/router/space-point/utils";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createCampaignEvent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      campaignId: z.string(),
      eventType: z.enum(["TRAINING", "STRATEGIC_MEETING", "REVIEW", "KICKOFF", "PRESENTATION", "DEADLINE"]),
      title: z.string().min(1),
      description: z.string().optional(),
      scheduledAt: z.string(),
      durationMinutes: z.number().default(60),
      meetingLink: z.string().optional(),
      participants: z.array(z.any()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { campaignId, ...data } = input;

    const campaign = await prisma.nasaCampaignPlanner.findFirst({
      where: { id: campaignId, organizationId: context.org.id, deletedAt: null },
    });
    if (!campaign) throw new Error("Planejamento não encontrado.");

    const event = await prisma.nasaCampaignEvent.create({
      data: {
        campaignPlannerId: campaignId,
        eventType: data.eventType,
        title: data.title,
        description: data.description,
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: data.durationMinutes,
        meetingLink: data.meetingLink,
        participants: data.participants ?? [],
      },
    });

    await awardPoints(context.user.id, context.org.id, "create_campaign_event");

    return { event };
  });
