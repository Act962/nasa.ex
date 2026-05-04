import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

export const deleteAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const existing = await prisma.action.findUnique({
        where: { id: input.actionId },
        select: { isArchived: true, createdBy: true, title: true },
      });

      if (!existing) {
        throw errors.NOT_FOUND;
      }

      if (!existing.isArchived || existing.createdBy !== context.user.id) {
        throw errors.FORBIDDEN;
      }

      const action = await prisma.action.delete({
        where: { id: input.actionId },
      });

      const orgId = context.session.activeOrganizationId;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "workspace",
          subAppSlug: "workspace-actions",
          featureKey: "workspace.action.deleted",
          action: "workspace.action.deleted",
          actionLabel: `Excluiu a ação "${existing.title}"`,
          resource: existing.title,
          resourceId: input.actionId,
        });
      }

      return { action };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
