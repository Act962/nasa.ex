import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateSubAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      subActionId: z.string(),
      title: z.string().min(1).optional(),
      isDone: z.boolean().optional(),
      description: z.string().nullable().optional(),
      finishDate: z.date().nullable().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { subActionId, ...data } = input;

    const subAction = await prisma.subActions.update({
      where: { id: subActionId },
      data,
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
