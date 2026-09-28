import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { resolveActionAccess } from "../lib/can-edit-action";

export const deleteAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Guards ficam fora do try: dentro dele o catch convertia NOT_FOUND e
    // FORBIDDEN em 500, escondendo a razão real da recusa.
    const existing = await prisma.action.findFirst({
      where: {
        id: input.actionId,
        workspace: { organizationId: context.org.id },
      },
      select: { isArchived: true, title: true },
    });

    if (!existing) {
      throw errors.NOT_FOUND({ message: "Ação não encontrada" });
    }

    const access = await resolveActionAccess(input.actionId, {
      userId: context.user.id,
      org: context.org,
    });
    if (!access?.canDelete) {
      throw errors.FORBIDDEN({
        message:
          "Você não tem permissão para excluir esta ação (participantes não podem excluir)",
      });
    }

    // Trava mantida: excluir é ação em 2 passos (arquivar → excluir), mesmo
    // para papéis privilegiados — rede contra exclusão acidental.
    if (!existing.isArchived) {
      throw errors.FORBIDDEN({
        message: "Arquive a ação antes de excluí-la",
      });
    }

    try {
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
