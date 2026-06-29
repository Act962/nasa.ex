import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { z } from "zod";
import { canManageGlobalFavorite } from "../lib/can-manage-global-favorite";

export const toggleFavoriteGlobal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const action = await prisma.action.findUnique({
      where: { id: input.actionId },
      select: { id: true, workspaceId: true, columnId: true, isFavorited: true },
    });
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    const allowed = await canManageGlobalFavorite(context.user.id, context.org.id);
    if (!allowed) {
      throw errors.FORBIDDEN({
        message: "Apenas Owner, Admin ou Moderador podem fixar para todos",
      });
    }

    const next = !action.isFavorited;
    const updated = await prisma.action.update({
      where: { id: action.id },
      data: { isFavorited: next },
      select: { id: true, isFavorited: true },
    });

    await logOrgActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "Usuário",
      userEmail: context.user.email ?? "",
      action: "action.updated",
      resource: "action",
      resourceId: action.id,
      metadata: {
        changes: ["isFavorited"],
        workspaceId: action.workspaceId,
        columnId: action.columnId,
        favoriteKind: "global",
        next,
      },
    });

    return { actionId: updated.id, isFavorited: updated.isFavorited };
  });
