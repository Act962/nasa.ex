import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listColumnSimple = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List all columns without actions",
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
    const columns = await prisma.workspaceColumn.findMany({
      where: {
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "asc",
      },
    });

    return {
      columns: columns.map((c) => ({
        ...c,
        order: c.order.toString(),
      })),
    };
  });
