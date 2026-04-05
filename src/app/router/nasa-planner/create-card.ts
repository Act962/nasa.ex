import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createCard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      mindMapId: z.string(),
      plannerId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      assigneeIds: z.array(z.string()).default([]),
      dueDate: z.string().optional(),
      linkedApp: z.string().optional(),
      linkedId: z.string().optional(),
      nodeId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    // Verify planner belongs to org
    await prisma.nasaPlanner.findFirstOrThrow({
      where: { id: input.plannerId, organizationId: context.org.id },
    });

    const card = await prisma.nasaPlannerCard.create({
      data: {
        mindMapId: input.mindMapId,
        plannerId: input.plannerId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeIds: input.assigneeIds,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        linkedApp: input.linkedApp,
        linkedId: input.linkedId,
        nodeId: input.nodeId,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      action: "planner.card.created",
      actionLabel: `Adicionou o card "${card.title}" no planner`,
      resource: card.title,
      resourceId: card.id,
      metadata: { plannerId: input.plannerId, priority: input.priority },
    });

    return { card };
  });
