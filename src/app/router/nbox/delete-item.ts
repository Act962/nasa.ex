import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ itemId: z.string() }))
  .handler(async ({ input, context }) => {
    const item = await prisma.nBoxItem.findUnique({
      where: { id: input.itemId, organizationId: context.org.id },
      select: { name: true },
    });

    await prisma.nBoxItem.delete({
      where: { id: input.itemId, organizationId: context.org.id },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nbox",
      action: "nbox.item.deleted",
      actionLabel: `Excluiu o arquivo "${item?.name ?? input.itemId}" do NBox`,
      resource: item?.name,
      resourceId: input.itemId,
    });

    return { ok: true };
  });
