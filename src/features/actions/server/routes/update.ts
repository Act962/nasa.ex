import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/lib/org-activity-log";
import { z } from "zod";
import { awardPoints } from "@/app/router/space-point/utils";
import {
  hasMovedColumnWorkflow,
  sendWorkspaceWorkflowEvent,
} from "@/inngest/utils";

export const updateAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      columnId: z.string().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
      isDone: z.boolean().optional(),
      orgProjectId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { actionId, ...data } = input;
    const { session } = context;
    const changedFields = Object.keys(data).filter(
      (key) => (data as Record<string, unknown>)[key] !== undefined,
    );

    const previous = await prisma.action.findUnique({
      where: { id: actionId },
    });

    const action = await prisma.action.update({
      where: { id: actionId },
      data: {
        ...data,
        closedAt:
          data.isDone === true
            ? new Date()
            : data.isDone === false
              ? null
              : undefined,
      },
    });

    if (changedFields.length > 0) {
      await logOrgActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name ?? "Usuário",
        userEmail: context.user.email ?? "",
        action: data.columnId !== undefined ? "action.moved" : "action.updated",
        resource: "action",
        resourceId: action.id,
        metadata: {
          changes: changedFields,
          ...(previous &&
            data.columnId !== undefined && {
              from: { columnId: previous.columnId },
              to: { columnId: data.columnId },
            }),
          ...(previous &&
            data.isDone !== undefined && {
              from: { isDone: previous.isDone },
              to: { isDone: data.isDone },
            }),
        },
      });
    }

    // Somente pontua quando transiciona de não-feito para concluído
    if (previous && !previous.isDone && data.isDone === true) {
      const orgId = session.activeOrganizationId;
      if (orgId) {
        await awardPoints(
          previous.createdBy,
          orgId,
          "complete_card",
          "Card concluído ✅",
        );
      }
      try {
        await sendWorkspaceWorkflowEvent({
          trigger: "WS_ACTION_COMPLETED",
          workspaceId: action.workspaceId,
          actionId: action.id,
        });
      } catch (err) {
        console.error(
          "[workspace-workflow] failed to emit action.completed",
          err,
        );
      }
    }

    if (
      previous &&
      data.columnId !== undefined &&
      data.columnId !== null &&
      previous.columnId !== data.columnId
    ) {
      try {
        if (await hasMovedColumnWorkflow(action.workspaceId, data.columnId)) {
          await sendWorkspaceWorkflowEvent({
            trigger: "WS_ACTION_MOVED_COLUMN",
            workspaceId: action.workspaceId,
            actionId: action.id,
            columnId: data.columnId,
          });
        }
      } catch (err) {
        console.error(
          "[workspace-workflow] failed to emit action.moved (update)",
          err,
        );
      }
    }

    return { action };
  });
