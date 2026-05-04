import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    name: z.string().min(1).max(100),
    parentId: z.string().optional(),
    color: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const folder = await prisma.nBoxFolder.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
        color: input.color ?? null,
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
