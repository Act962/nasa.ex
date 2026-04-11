import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { awardPoints } from "@/app/router/space-point/utils";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createCampaignTask = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      campaignId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
      dueDate: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { campaignId, dueDate, tags, ...rest } = input;

    const campaign = await prisma.nasaCampaignPlanner.findFirst({
      where: { id: campaignId, organizationId: context.org.id, deletedAt: null },
    });
    if (!campaign) throw new Error("Planejamento não encontrado.");

    const task = await prisma.nasaCampaignTask.create({
      data: {
        campaignPlannerId: campaignId,
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags ?? [],
      },
    });

    await awardPoints(context.user.id, context.org.id, "create_campaign_task");

    return { task };
  });
