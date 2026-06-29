import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { awardPoints } from "@/app/router/space-point/utils";
import { Prisma } from "@/generated/prisma/client";
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
      workspaceId: z.string().optional(),
      columnId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { campaignId, dueDate, tags, workspaceId, columnId, ...rest } = input;

    const campaign = await prisma.nasaCampaignPlanner.findFirst({
      where: { id: campaignId, organizationId: context.org.id, deletedAt: null },
    });
    if (!campaign) throw new Error("Planejamento não encontrado.");

    let linkedActionId: string | null = null;

    // Create workspace Action card if workspace + column provided
    if (workspaceId && columnId) {
      try {
        const firstAction = await prisma.action.findFirst({
          where: { columnId, workspaceId },
          orderBy: { order: "asc" },
        });
        const newOrder = firstAction
          ? Prisma.Decimal.sub(firstAction.order, 1)
          : new Prisma.Decimal(0);

        const action = await prisma.action.create({
          data: {
            title: input.title,
            description: input.description,
            type: "TASK",
            priority: input.priority as any,
            dueDate: dueDate ? new Date(dueDate) : null,
            workspaceId,
            columnId,
            organizationId: context.org.id,
            order: newOrder,
            createdBy: context.user.id,
            participants: { create: { userId: context.user.id } },
          },
        });
        linkedActionId = action.id;
      } catch {
        // best-effort
      }
    }

    const task = await prisma.nasaCampaignTask.create({
      data: {
        campaignPlannerId: campaignId,
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags ?? [],
      },
    });

    awardPoints(context.user.id, context.org.id, "create_campaign_task").catch(() => {});

    return { task, linkedActionId };
  });
