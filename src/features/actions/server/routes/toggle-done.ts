import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { runActionCompletedEffects } from "@/features/actions/server/lib/complete-action";

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

    const previous = await prisma.action.findFirst({
      where: { id: actionId, workspace: { organizationId: context.org.id } },
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

    const orgId = session.activeOrganizationId;
    const wentToDone = !previous.isDone && isDone;
    const wentToReopen = previous.isDone && !isDone;

    if (wentToDone && orgId) {
      await runActionCompletedEffects({
        action: { id: action.id, title: action.title, createdBy: previous.createdBy, workspaceId: action.workspaceId },
        organizationId: orgId,
        actor: {
          id: context.user.id,
          name: context.user.name,
          email: context.user.email,
          image: (context.user as { image?: string | null }).image,
        },
      });
    }

    if (wentToReopen && orgId) {
      await logActivity({
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string | null }).image,
        appSlug: "workspace",
        subAppSlug: "workspace-actions",
        featureKey: "workspace.action.reopened",
        action: "workspace.action.reopened",
        actionLabel: `Reabriu a ação "${action.title}"`,
        resource: action.title,
        resourceId: action.id,
        metadata: { changedFields: ["isDone"] },
      });
    }

    return { action };
  });
