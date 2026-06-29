import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

export const deleteTag = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      tagId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const tag = await prisma.tag.findUnique({
      where: {
        id: input.tagId,
      },
    });

    if (!tag) {
      throw errors.BAD_REQUEST({
        message: "Tag não encontrada",
      });
    }

    // SOFT-DELETE (TAGS 2.0): substituiu `prisma.tag.delete()` por update
    // setando `archivedAt`. Preserva histórico em Jornada/Insights/contatos/
    // Detalhes. Hard-delete fica no `tag.purge` (admin-only, irreversível).
    const archived = await prisma.tag.update({
      where: { id: input.tagId },
      data: {
        archivedAt: new Date(),
        archivedById: context.user.id,
      },
    });

    await logActivity({
      organizationId: tag.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      subAppSlug: "tracking-tags",
      featureKey: "tag.archived",
      action: "tag.archived",
      actionLabel: `Arquivou a tag "${tag.name}"`,
      resource: tag.name,
      resourceId: tag.id,
      metadata: {
        trackingId: tag.trackingId ?? undefined,
        color: tag.color ?? undefined,
      },
    });

    return archived;
  });
