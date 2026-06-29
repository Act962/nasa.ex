import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateCampaignTask = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      campaignId: z.string(),
      taskId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      assignedTo: z.string().nullable().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      status: z.enum(["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED", "BLOCKED"]).optional(),
      dueDate: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { campaignId, taskId, dueDate, ...rest } = input;

    const task = await prisma.nasaCampaignTask.findFirst({
      where: { id: taskId, campaignPlannerId: campaignId, campaignPlanner: { organizationId: context.org.id } },
    });
    if (!task) throw new Error("Tarefa não encontrada.");

    const updated = await prisma.nasaCampaignTask.update({
      where: { id: taskId },
      data: {
        ...rest,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      },
    });

    return { task: updated };
  });
