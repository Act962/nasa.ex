import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findTagInOrg } from "../lib/workspace-access";

export const deleteTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ tagId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const tag = await findTagInOrg(input.tagId, context.org.id);
    if (!tag) throw errors.NOT_FOUND({ message: "Tag não encontrada" });

    await prisma.workspaceTag.delete({ where: { id: input.tagId } });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "workspace",
      subAppSlug: "workspace-tags",
      featureKey: "workspace.tag.deleted",
      action: "workspace.tag.deleted",
      actionLabel: `Excluiu a tag "${tag.name}" do workspace`,
      resource: tag.name,
      resourceId: input.tagId,
      metadata: {
        workspaceId: tag.workspaceId,
        color: tag.color ?? undefined,
      },
    });

    return { success: true };
  });
