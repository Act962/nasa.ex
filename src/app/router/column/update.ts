import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateColumn = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    summary: "Update a column",
    tags: ["Column"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const column = await prisma.workspaceColumn.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name,
        color: input.color,
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    return {
      success: true,
      workspaceId: column.workspaceId,
    };
  });
