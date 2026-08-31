import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findActionInOrg } from "../lib/action-access";

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
  .handler(async ({ input, context, errors }) => {
    const action = await findActionInOrg(input.actionId, context.org.id);
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    const ownedGroups = await prisma.subActionGroup.count({
      where: {
        id: { in: input.items.map((item) => item.id) },
        actionId: input.actionId,
      },
    });
    if (ownedGroups !== input.items.length) {
      throw errors.FORBIDDEN({ message: "Grupos não pertencem a esta ação" });
    }

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
