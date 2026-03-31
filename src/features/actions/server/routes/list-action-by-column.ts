import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listActionByColumn = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      columnId: z.string(),
      cursor: z.string().nullish(),
      limit: z.number().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ input }) => {
    const limit = input.limit;
    const action = await prisma.action.findMany({
      where: {
        columnId: input.columnId,
      },
      take: limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: {
        order: "asc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        startDate: true,
        columnId: true,
        createdBy: true,
        order: true,
        isDone: true,
        priority: true,
        user: {
          select: {
            id: true,
            image: true,
            name: true,
          },
        },
        participants: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        subActions: {
          select: {
            id: true,
            isDone: true,
          },
        },
        createdAt: true,
      },
    });

    let nextCursor: typeof input.cursor | undefined = undefined;
    if (action.length > limit) {
      const nextItem = action.pop();
      nextCursor = nextItem!.id;
    }

    return { action, nextCursor };
  });
