import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
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

    const deleted = await prisma.tag.delete({
      where: {
        id: input.tagId,
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
      featureKey: "tag.deleted",
      action: "tag.deleted",
      actionLabel: `Excluiu a tag "${tag.name}"`,
      resource: tag.name,
      resourceId: tag.id,
      metadata: {
        trackingId: tag.trackingId ?? undefined,
        color: tag.color ?? undefined,
      },
    });

    return deleted;
  });
