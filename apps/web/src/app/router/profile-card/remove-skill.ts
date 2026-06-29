import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

export const removeSkill = base
  .use(requiredAuthMiddleware)
  .input(z.object({ skillId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const card = await prisma.userProfileCard.findUnique({
      where: { userId: context.user.id },
      select: { id: true },
    });
    if (!card) return { ok: true };

    await prisma.userSkill
      .delete({
        where: {
          profileId_skillId: {
            profileId: card.id,
            skillId: input.skillId,
          },
        },
      })
      .catch(() => null);

    return { ok: true };
  });
