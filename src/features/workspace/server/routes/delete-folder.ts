import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ folderId: z.string() }))
  .handler(async ({ input }) => {
    await prisma.workspaceFolder.delete({ where: { id: input.folderId } });
    return { success: true };
  });
