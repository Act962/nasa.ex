import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const reorderSubActionGroups = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      items: z
        .array(
          z.object({
            id: z.string(),
            order: z.number().int(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ input }) => {
    await prisma.$transaction(
      input.items.map((item) =>
        prisma.subActionGroup.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    return { success: true };
  });
