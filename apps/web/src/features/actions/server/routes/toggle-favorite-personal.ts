import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const toggleFavoritePersonal = base
  .use(requiredAuthMiddleware)
  .input(z.object({ actionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const action = await prisma.action.findUnique({
      where: { id: input.actionId },
      select: { id: true },
    });
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
