import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listFolders = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const folders = await prisma.workspaceFolder.findMany({
      where: { organizationId: context.org.id },
      orderBy: { order: "asc" },
      include: { items: { include: { workspace: true }, orderBy: { order: "asc" } } },
    });
    return { folders };
  });
