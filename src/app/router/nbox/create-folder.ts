import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  canViewRestrictedNBox,
  loadFolderRestriction,
} from "@/features/nbox/server/can-view-restricted-nbox";

export const createFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    name: z.string().min(1).max(100),
    parentId: z.string().optional(),
    color: z.string().optional(),
  }))
  .handler(async ({ input, context, errors }) => {
    const parent = await loadFolderRestriction(input.parentId, context.org.id);
    if (parent?.isRestricted && !(await canViewRestrictedNBox(context.user, context.org.id))) {
      throw errors.FORBIDDEN({ message: "Pasta restrita: só administradores do financeiro." });
    }

    const folder = await prisma.nBoxFolder.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
        color: input.color ?? null,
        // Subpasta de pasta restrita nasce restrita, senão vazaria o conteúdo.
        isRestricted: parent?.isRestricted ?? false,
        organizationId: context.org.id,
        createdById: context.user.id,
      },
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nbox",
      subAppSlug: "nbox-folders",
      featureKey: "nbox.folder.created",
      action: "nbox.folder.created",
      actionLabel: `Criou a pasta "${folder.name}" no NBox`,
      resource: folder.name,
      resourceId: folder.id,
    });

    return { folder };
  });
