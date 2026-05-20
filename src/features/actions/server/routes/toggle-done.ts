import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { awardPoints } from "@/app/router/space-point/utils";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  hasActionCompletedWorkflow,
  sendWorkspaceWorkflowEvent,
} from "@/inngest/utils";

export const toggleDone = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      isDone: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { actionId, isDone } = input;
    const { session } = context;

    const previous = await prisma.action.findUnique({
      where: { id: actionId },
      select: { id: true, isDone: true, title: true, createdBy: true },
    });

    if (!previous) {
      throw errors.NOT_FOUND({ message: "Ação não encontrada" });
    }

    const action = await prisma.action.update({
      where: { id: actionId },
      data: {
        isDone,
        closedAt: isDone ? new Date() : null,
      },
    });

    if (!previous.isDone && isDone) {
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
        if (await hasActionCompletedWorkflow(action.workspaceId)) {
          await sendWorkspaceWorkflowEvent({
            trigger: "WS_ACTION_COMPLETED",
            workspaceId: action.workspaceId,
            actionId: action.id,
          });
        }
      } catch (err) {
        console.error(
          "[workspace-workflow] failed to emit action.completed",
          err,
        );
      }
    }

    const orgId = session.activeOrganizationId;
    if (orgId) {
      const wentToDone = !previous.isDone && isDone;
      const wentToReopen = previous.isDone && !isDone;

      if (wentToDone || wentToReopen) {
        const featureKey = wentToDone
          ? "workspace.action.completed"
          : "workspace.action.reopened";
        const actionLabel = wentToDone
          ? `Concluiu a ação "${action.title}"`
          : `Reabriu a ação "${action.title}"`;

        await logActivity({
          organizationId: orgId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "workspace",
          subAppSlug: "workspace-actions",
          featureKey,
          action: featureKey,
          actionLabel,
          resource: action.title,
          resourceId: action.id,
          metadata: { changedFields: ["isDone"] },
        });
      }
    }

    return { action };
  });
