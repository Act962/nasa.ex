import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

export const removeTool = base
  .use(requiredAuthMiddleware)
  .input(z.object({ toolId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const card = await prisma.userProfileCard.findUnique({
      where: { userId: context.user.id },
      select: { id: true },
    });
    if (!card) return { ok: true };

    await prisma.userTool
      .delete({
        where: {
          profileId_toolId: {
            profileId: card.id,
            toolId: input.toolId,
          },
        },
      })
      .catch(() => null);

    return { ok: true };
  });
