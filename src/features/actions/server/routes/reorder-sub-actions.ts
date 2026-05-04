import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const reorderSubActions = base
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
            groupId: z.string().nullable().optional(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ input }) => {
    await prisma.$transaction(
      input.items.map((item) =>
        prisma.subActions.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.groupId !== undefined && { groupId: item.groupId }),
          },
        }),
      ),
    );

    return { success: true };
  });
