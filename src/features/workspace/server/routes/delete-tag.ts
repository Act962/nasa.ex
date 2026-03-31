import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ tagId: z.string() }))
  .handler(async ({ input }) => {
    await prisma.workspaceTag.delete({ where: { id: input.tagId } });
    return { success: true };
  });
