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

export const moveActions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionIds: z.array(z.string()),
      columnId: z.string(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const actions = await prisma.action.findMany({
      where: { id: { in: input.actionIds } },
      select: { id: true, columnId: true, workspaceId: true },
    });

    await prisma.$transaction(
      actions.map((action) => {
        return prisma.action.update({
          where: { id: action.id },
          data: {
            columnId: input.columnId,
            workspaceId: input.workspaceId,
          },
        });
      }),
    );

    await Promise.all(
      actions.map((action) =>
        logOrgActivity({
          organizationId: context.org.id,
          userId: context.user.id,
          userName: context.user.name ?? "Usuário",
          userEmail: context.user.email ?? "",
          action: "action.moved",
          resource: "action",
          resourceId: action.id,
          metadata: {
            from: {
              columnId: action.columnId,
              workspaceId: action.workspaceId,
            },
            to: {
              columnId: input.columnId,
              workspaceId: input.workspaceId,
            },
          },
        }),
      ),
    );

    const shouldEmit =
      actions.some((a) => a.columnId !== input.columnId) &&
      (await hasMovedColumnWorkflow(input.workspaceId, input.columnId));

    if (shouldEmit) {
      for (const a of actions) {
        if (a.columnId === input.columnId) continue;
        try {
          await sendWorkspaceWorkflowEvent({
            trigger: "WS_ACTION_MOVED_COLUMN",
            workspaceId: input.workspaceId,
            actionId: a.id,
            columnId: input.columnId,
          });
        } catch (err) {
          console.error(
            "[workspace-workflow] failed to emit action.moved (bulk)",
            err,
          );
        }
      }
    }

    return { success: true };
  });
