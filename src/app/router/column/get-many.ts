import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getMany = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get all columns for a workspace",
    tags: ["Column"],
  })
  .input(
    z.object({
      workspaceId: z.string(),
    }),
  )
  .output(
    z.object({
      columns: z.array(z.any()),
    }),
  )
  .handler(async ({ input }) => {
    const result = await prisma.workspaceColumn.findMany({
      where: {
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "asc",
      },
      include: {
        _count: {
          select: {
            actions: true,
          },
        },
      },
    });

    return {
      columns: result.map((column) => ({
        ...column,
        order: column.order.toString(),
        actionsCount: column._count.actions,
      })),
    };
  });
