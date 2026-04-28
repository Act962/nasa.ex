import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/lib/org-activity-log";
import {
  hasMovedColumnWorkflow,
  sendWorkspaceWorkflowEvent,
} from "@/inngest/utils";
import { z } from "zod";

export const moveAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      columnId: z.string(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const existing = await prisma.action.findUnique({
      where: { id: input.actionId },
      select: { columnId: true, workspaceId: true },
    });

    const action = await prisma.action.update({
      where: { id: input.actionId },
      data: {
        columnId: input.columnId,
        workspaceId: input.workspaceId,
      },
    });

    await logOrgActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "Usuário",
      userEmail: context.user.email ?? "",
      action: "action.moved",
      resource: "action",
      resourceId: action.id,
      metadata: {
        from: existing
          ? { columnId: existing.columnId, workspaceId: existing.workspaceId }
          : undefined,
        to: { columnId: input.columnId, workspaceId: input.workspaceId },
      },
    });
    if (existing?.columnId !== input.columnId) {
      try {
        if (
          await hasMovedColumnWorkflow(input.workspaceId, input.columnId)
        ) {
          await sendWorkspaceWorkflowEvent({
            trigger: "WS_ACTION_MOVED_COLUMN",
            workspaceId: input.workspaceId,
            actionId: input.actionId,
            columnId: input.columnId,
          });
        }
      } catch (err) {
        console.error("[workspace-workflow] failed to emit action.moved", err);
      }
    }

    return { action };
  });
