import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resolveWorkspaceTrackingId } from "@/features/actions/lib/workspace-tracking";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { findColumnInOrg } from "../lib/workspace-access";
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
  .handler(async ({ input, context, errors }) => {
    const targetColumn = await findColumnInOrg(input.columnId, context.org.id);
    if (!targetColumn || targetColumn.workspaceId !== input.workspaceId) {
      throw errors.NOT_FOUND({ message: "Coluna não encontrada" });
    }

    // Só movem as ações da própria org; ids intrusos saem do conjunto.
    const actions = await prisma.action.findMany({
      where: {
        id: { in: input.actionIds },
        workspace: { organizationId: context.org.id },
      },
      select: { id: true, columnId: true, workspaceId: true },
    });

    // Mudar de workspace pode mudar o tracking: re-resolve em vez de deixar
    // o valor antigo (que apontaria pro tracking do workspace de origem).
    const trackingId = await resolveWorkspaceTrackingId(input.workspaceId);

    await prisma.$transaction(
      actions.map((action) => {
        return prisma.action.update({
          where: { id: action.id },
          data: {
            columnId: input.columnId,
            workspaceId: input.workspaceId,
            trackingId,
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
