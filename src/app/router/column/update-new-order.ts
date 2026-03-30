import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

export const updateNewOrder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    summary: "Update column order",
    tags: ["Column"],
  })
  .input(
    z.object({
      id: z.string(),
      order: z.string(),
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
        order: new Decimal(input.order),
      },
    });

    return {
      success: true,
      workspaceId: column.workspaceId,
    };
  });
