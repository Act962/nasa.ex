import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findFolderInOrg } from "../lib/workspace-access";

export const deleteFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ folderId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await findFolderInOrg(input.folderId, context.org.id);
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Pasta não encontrada" });
    }

    await prisma.workspaceFolder.delete({ where: { id: input.folderId } });
    return { success: true };
  });
