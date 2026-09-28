import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import {
  hasMovedColumnWorkflow,
  sendWorkspaceWorkflowEvent,
} from "@/inngest/utils";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";

export const reorderAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      columnId: z.string(),
      beforeId: z.string().optional().nullable(),
      afterId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const { id, columnId, beforeId, afterId } = input;

    const result = await prisma.$transaction(async (tx) => {
      const currentAction = await tx.action.findFirst({
        where: { id, workspace: { organizationId: context.org.id } },
      });

      if (!currentAction) {
        throw errors.NOT_FOUND({ message: "Ação não encontrada" });
      }
      const previousColumnId = currentAction.columnId;

      // Coluna destino tem que ser do mesmo workspace: sem isso, o id de uma
      // coluna alheia arrasta o card pra fora da org.
      const targetColumn = await tx.workspaceColumn.findFirst({
        where: { id: columnId, workspaceId: currentAction.workspaceId },
        select: { id: true },
      });
      if (!targetColumn) {
        throw errors.NOT_FOUND({ message: "Coluna não encontrada" });
      }

      let newOrder: Prisma.Decimal;

      // Vizinhos só contam se forem do mesmo workspace — id de fora não pode
      // servir de âncora nem devolver a ordem de um card alheio.
      const [before, after] = await Promise.all([
        beforeId
          ? tx.action.findFirst({
              where: { id: beforeId, workspaceId: currentAction.workspaceId },
              select: { order: true },
            })
          : null,
        afterId
          ? tx.action.findFirst({
              where: { id: afterId, workspaceId: currentAction.workspaceId },
              select: { order: true },
            })
          : null,
      ]);

      if (before && after) {
        newOrder = Prisma.Decimal.add(before.order, after.order).div(2);
      } else if (before) {
        newOrder = Prisma.Decimal.add(before.order, 1000);
      } else if (after) {
        newOrder = Prisma.Decimal.sub(after.order, 1000);
      } else {
        // Empty column
        newOrder = new Prisma.Decimal(1000);
      }

      const updatedAction = await tx.action.update({
        where: { id },
        data: {
          columnId,
          order: newOrder,
        },
      });

      return { action: updatedAction, previousColumnId };
    });

    if (result.previousColumnId !== columnId) {
      try {
        if (
          await hasMovedColumnWorkflow(result.action.workspaceId, columnId)
        ) {
          await sendWorkspaceWorkflowEvent({
            trigger: "WS_ACTION_MOVED_COLUMN",
            workspaceId: result.action.workspaceId,
            actionId: result.action.id,
            columnId,
          });
        }
      } catch (err) {
        console.error(
          "[workspace-workflow] failed to emit action.moved (reorder)",
          err,
        );
      }
    }

    const orgId = context.session.activeOrganizationId;
    if (orgId) {
      const moved = result.previousColumnId !== columnId;
      await logActivity({
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "workspace",
        subAppSlug: "workspace-actions",
        featureKey: moved ? "workspace.action.moved" : "workspace.action.reordered",
        action: moved ? "workspace.action.moved" : "workspace.action.reordered",
        actionLabel: moved
          ? `Moveu a ação "${result.action.title}" entre colunas`
          : `Reordenou a ação "${result.action.title}" na coluna`,
        resource: result.action.title,
        resourceId: result.action.id,
        metadata: {
          fromColumnId: result.previousColumnId,
          toColumnId: columnId,
          dragSource: "kanban",
        },
      });
    }

    return { action: result.action };
  });
