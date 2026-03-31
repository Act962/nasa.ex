import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const removeTagFromAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), tagId: z.string() }))
  .handler(async ({ input }) => {
    await prisma.actionTag.delete({
      where: { actionId_tagId: { actionId: input.actionId, tagId: input.tagId } },
    });
    return { success: true };
  });
