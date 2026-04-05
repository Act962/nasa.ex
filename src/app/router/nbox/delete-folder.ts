import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ folderId: z.string() }))
  .handler(async ({ input, context }) => {
    const folder = await prisma.nBoxFolder.findUnique({
      where: { id: input.folderId, organizationId: context.org.id },
      select: { name: true },
    });

    await prisma.nBoxFolder.delete({
      where: { id: input.folderId, organizationId: context.org.id },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nbox",
      action: "nbox.folder.deleted",
      actionLabel: `Excluiu a pasta "${folder?.name ?? input.folderId}" do NBox`,
      resource: folder?.name,
      resourceId: input.folderId,
    });

    return { ok: true };
  });
