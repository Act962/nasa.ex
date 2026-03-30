import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const addSubActionResponsible = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      subActionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const responsible = await prisma.subActionUserResponsible.upsert({
      where: {
        userId_subActionId: {
          userId: input.userId,
          subActionId: input.subActionId,
        },
      },
      create: {
        userId: input.userId,
        subActionId: input.subActionId,
      },
      update: {},
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        subAction: {
          include: {
            action: {
              select: { id: true, workspaceId: true },
            },
          },
        },
      },
    });

    return { responsible };
  });
