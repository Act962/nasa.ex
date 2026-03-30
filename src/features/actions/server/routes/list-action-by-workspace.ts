import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listActionByWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      page: z.number().optional().default(1),
      limit: z.number().optional().default(20),
    }),
  )

  .handler(async ({ input }) => {
    const where = {
      workspaceId: input.workspaceId,
    };

    console.log("Innput", input);

    const [actions, total] = await Promise.all([
      prisma.action.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
        skip: Math.max(0, (input.page - 1) * input.limit),
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          startDate: true,
          columnId: true,
          createdBy: true,
          priority: true,
          isDone: true,
          column: {
            select: {
              id: true,
              name: true,
              color: true,
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
      }),
      prisma.action.count({
        where,
      }),
    ]);

    const lastPage = Math.ceil(total / input.limit);

    return {
      actions,
      total,
      page: input.page,
      limit: input.limit,
      lastPage,
    };
  });
