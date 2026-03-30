import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getFolders = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const folders = await prisma.nBoxFolder.findMany({
      where: { organizationId: context.org.id },
      orderBy: { name: "asc" },
    });
    return { folders };
  });
