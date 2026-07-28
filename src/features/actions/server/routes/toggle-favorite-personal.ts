import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findActionInOrg } from "../lib/action-access";

export const toggleFavoritePersonal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const action = await findActionInOrg(input.actionId, context.org.id);
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    const existing = await prisma.actionFavorite.findUnique({
      where: {
        actionId_userId: {
          actionId: input.actionId,
          userId: context.user.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.actionFavorite.delete({ where: { id: existing.id } });
      return { actionId: input.actionId, favorited: false };
    }

    await prisma.actionFavorite.create({
      data: { actionId: input.actionId, userId: context.user.id },
    });
    return { actionId: input.actionId, favorited: true };
  });
