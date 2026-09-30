import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  canViewRestrictedNBox,
  isItemInRestrictedFolder,
  loadFolderRestriction,
} from "@/features/nbox/server/can-view-restricted-nbox";

export const updateItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    itemId: z.string(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    folderId: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  }))
  .handler(async ({ input, context, errors }) => {
    const isCurrentlyRestricted = await isItemInRestrictedFolder(input.itemId, context.org.id);
    const targetFolder = input.folderId ? await loadFolderRestriction(input.folderId, context.org.id) : null;
    const isMovingIntoRestricted = targetFolder?.isRestricted === true;
    if (
      (isCurrentlyRestricted || isMovingIntoRestricted) &&
      !(await canViewRestrictedNBox(context.user, context.org.id))
    ) {
      throw errors.FORBIDDEN({ message: "Arquivo restrito: só administradores do financeiro." });
    }

    const item = await prisma.nBoxItem.update({
      where: { id: input.itemId, organizationId: context.org.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.folderId !== undefined && { folderId: input.folderId }),
        ...(input.tags !== undefined && { tags: input.tags }),
        // Item em pasta restrita nunca fica público.
        ...(isMovingIntoRestricted && { isPublic: false, publicToken: null }),
      },
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nbox",
      action: "nbox.item.updated",
      actionLabel: `Atualizou o arquivo "${item.name}" no NBox`,
      resource: item.name,
      resourceId: item.id,
    });

    return { item };
  });
