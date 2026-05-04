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
import { logActivity } from "@/lib/activity-logger";

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
      const currentAction = await tx.action.findUnique({
        where: { id },
      });

      if (!currentAction) throw errors.NOT_FOUND;
      const previousColumnId = currentAction.columnId;

      let newOrder: Prisma.Decimal;

      const [before, after] = await Promise.all([
        beforeId
          ? tx.action.findUnique({
              where: { id: beforeId },
              select: { order: true },
            })
          : null,
        afterId
          ? tx.action.findUnique({
              where: { id: afterId },
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
