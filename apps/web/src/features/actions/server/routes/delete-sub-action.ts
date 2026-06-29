import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteSubAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      subActionId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const subAction = await prisma.subActions.delete({
      where: { id: input.subActionId },
      include: {
        action: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    return { subAction };
  });
