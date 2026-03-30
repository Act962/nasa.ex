import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const addParticipant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const participant = await prisma.actionsUserParticipant.upsert({
      where: {
        actionId_userId: {
          actionId: input.actionId,
          userId: input.userId,
        },
      },
      create: {
        actionId: input.actionId,
        userId: input.userId,
      },
      update: {},
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
        action: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    return { participant };
  });
