import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteColumn = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a column",
    tags: ["Column"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const column = await prisma.workspaceColumn.delete({
      where: {
        id: input.id,
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
