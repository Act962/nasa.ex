import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteSubActionGroup = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      groupId: z.string(),
      deleteSubActions: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input }) => {
    if (input.deleteSubActions) {
      await prisma.subActions.deleteMany({
        where: { groupId: input.groupId },
      });
    }
    const group = await prisma.subActionGroup.delete({
      where: { id: input.groupId },
    });
    return { group };
  });
