import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createSubAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      title: z.string().min(1, "Título é obrigatório"),
      finishDate: z.date().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const subAction = await prisma.subActions.create({
      data: {
        title: input.title,
        actionId: input.actionId,
        finishDate: input.finishDate,
      },
      include: {
        responsibles: {
          select: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
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
