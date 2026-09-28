import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resolveWorkspaceTrackingId } from "@/features/actions/lib/workspace-tracking";
import { findActionInOrg } from "@/features/actions/server/lib/action-access";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { findColumnInOrg } from "../lib/workspace-access";
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
  .handler(async ({ input, context, errors }) => {
    const existing = await findActionInOrg(input.actionId, context.org.id);
    if (!existing) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    // Destino também escopado: sem isso a ação é arrastada pra workspace/coluna
    // de outra org só passando o id.
    const targetColumn = await findColumnInOrg(input.columnId, context.org.id);
    if (!targetColumn || targetColumn.workspaceId !== input.workspaceId) {
      throw errors.NOT_FOUND({ message: "Coluna não encontrada" });
    }

    // Mudar de workspace pode mudar o tracking: re-resolve em vez de deixar
    // o valor antigo (que apontaria pro tracking do workspace de origem).
    const trackingId = await resolveWorkspaceTrackingId(input.workspaceId);

    const action = await prisma.action.update({
      where: { id: input.actionId },
      data: {
        columnId: input.columnId,
        workspaceId: input.workspaceId,
        trackingId,
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
