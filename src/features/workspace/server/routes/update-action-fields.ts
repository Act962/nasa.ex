import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/lib/org-activity-log";
import { z } from "zod";

export const updateActionFields = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      attachments: z.array(z.record(z.string(), z.any())).optional(),
      links: z.array(z.record(z.string(), z.any())).optional(),
      youtubeUrl: z.string().nullable().optional(),
      coverImage: z.string().nullable().optional(),
      isArchived: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { actionId, ...data } = input;
    const existing = await prisma.action.findUnique({
      where: { id: actionId },
      select: {
        workspaceId: true,
        columnId: true,
        title: true,
        isArchived: true,
        isFavorited: true,
      },
    });
    const changedFields = Object.keys(data).filter(
      (key) => (data as Record<string, unknown>)[key] !== undefined,
    );
    const action = await prisma.action.update({
      where: { id: actionId },
      data,
    });

    if (changedFields.length > 0) {
      await logOrgActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name ?? "Usuário",
        userEmail: context.user.email ?? "",
        action: "action.updated",
        resource: "action",
        resourceId: actionId,
        metadata: {
          changes: changedFields,
          workspaceId: existing?.workspaceId,
          columnId: existing?.columnId,
        },
      });

      // Log para Insights (SystemActivityLog) — granular por tipo de mudança
      let featureKey = "workspace.action.fields.updated";
      let actionLabel = `Atualizou campos da ação "${action.title}"`;
      let subAppSlug = "workspace-actions";

      if (data.isArchived === true && existing && !existing.isArchived) {
        featureKey = "workspace.action.archived";
        actionLabel = `Arquivou a ação "${action.title}"`;
        subAppSlug = "workspace-actions-archive";
      } else if (data.isArchived === false && existing?.isArchived) {
        featureKey = "workspace.action.restored";
        actionLabel = `Restaurou a ação "${action.title}"`;
        subAppSlug = "workspace-actions-archive";
      } else if (data.isFavorited === true && existing && !existing.isFavorited) {
        featureKey = "workspace.action.favorited";
        actionLabel = `Favoritou a ação "${action.title}"`;
      } else if (data.isFavorited === false && existing?.isFavorited) {
        featureKey = "workspace.action.unfavorited";
        actionLabel = `Removeu favorito da ação "${action.title}"`;
      } else if (data.coverImage !== undefined) {
        featureKey = "workspace.action.cover.updated";
        actionLabel = `Atualizou a capa da ação "${action.title}"`;
      } else if (data.youtubeUrl !== undefined) {
        featureKey = "workspace.action.youtube.updated";
        actionLabel = `Atualizou vídeo do YouTube na ação "${action.title}"`;
      } else if (data.attachments !== undefined) {
        featureKey = "workspace.action.attachments.updated";
        actionLabel = `Atualizou anexos da ação "${action.title}"`;
      } else if (data.links !== undefined) {
        featureKey = "workspace.action.links.updated";
        actionLabel = `Atualizou links da ação "${action.title}"`;
      }

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "workspace",
        subAppSlug,
        featureKey,
        action: featureKey,
        actionLabel,
        resource: action.title,
        resourceId: actionId,
        metadata: {
          workspaceId: existing?.workspaceId,
          columnId: existing?.columnId,
          changedFields,
        },
      });
    }

    return { action };
  });
