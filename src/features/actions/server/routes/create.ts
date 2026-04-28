import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/lib/org-activity-log";
import { sendWorkspaceWorkflowEvent } from "@/inngest/utils";
import { z } from "zod";

export const createAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      title: z.string().min(1, "Título é obrigatório"),
      description: z.string().optional(),
      priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]),
      dueDate: z.date().optional(),
      startDate: z.date().optional(),
      workspaceId: z.string().min(1, "Workspace é obrigatório"),
      columnId: z.string().min(1, "Coluna é obrigatória"),
      orgProjectId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const firstAction = await prisma.action.findFirst({
      where: {
        columnId: input.columnId,
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "asc",
      },
    });

    let newOrder: Prisma.Decimal;

    if (firstAction) {
      newOrder = Prisma.Decimal.sub(firstAction.order, 1);
    } else {
      newOrder = new Prisma.Decimal(0);
    }

    const action = await prisma.action.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        startDate: input.startDate,
        workspaceId: input.workspaceId,
        order: newOrder,
        columnId: input.columnId,
        orgProjectId: input.orgProjectId,
        createdBy: context.user.id,
        participants: {
          create: {
            userId: context.user.id,
          },
        },
      },
    });

    await logOrgActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "Usuário",
      userEmail: context.user.email ?? "",
      action: "action.created",
      resource: "action",
      resourceId: action.id,
      metadata: {
        workspaceId: action.workspaceId,
        columnId: action.columnId,
        priority: action.priority,
      },
    });

    try {
      const hasMatchingWorkflow = await prisma.workflow.findFirst({
        where: {
          workspaceId: action.workspaceId,
          isActive: true,
          nodes: { some: { type: "WS_ACTION_CREATED" } },
        },
        select: { id: true },
      });

      if (hasMatchingWorkflow) {
        await sendWorkspaceWorkflowEvent({
          trigger: "WS_ACTION_CREATED",
          workspaceId: action.workspaceId,
          actionId: action.id,
        });
      }
    } catch (err) {
      console.error("[workspace-workflow] failed to emit action.created", err);
    }

    return {
      action,
    };
  });
