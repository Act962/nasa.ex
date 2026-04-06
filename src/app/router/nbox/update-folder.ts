import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    folderId: z.string(),
    name: z.string().min(1).max(100).optional(),
    color: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const folder = await prisma.nBoxFolder.update({
      where: { id: input.folderId, organizationId: context.org.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
      },
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nbox",
      action: "nbox.folder.updated",
      actionLabel: `Atualizou a pasta "${folder.name}" no NBox`,
      resource: folder.name,
      resourceId: folder.id,
    });

    return { folder };
  });
