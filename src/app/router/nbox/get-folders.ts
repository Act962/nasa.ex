import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { canViewRestrictedNBox } from "@/features/nbox/server/can-view-restricted-nbox";

export const getFolders = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const canViewRestricted = await canViewRestrictedNBox(context.user, context.org.id);
    const folders = await prisma.nBoxFolder.findMany({
      where: {
        organizationId: context.org.id,
        ...(canViewRestricted ? {} : { isRestricted: false }),
      },
      orderBy: { name: "asc" },
    });
    return { folders };
  });
