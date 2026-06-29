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
      beforeId: z.string().optional().nullable(),
      afterId: z.string().optional().nullable(),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { id, beforeId, afterId } = input;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.workspaceColumn.findUnique({
        where: { id },
      });

      if (!current) throw errors.NOT_FOUND;

      let newOrder: Decimal;

      const [before, after] = await Promise.all([
        beforeId
          ? tx.workspaceColumn.findUnique({
              where: { id: beforeId },
              select: { order: true },
            })
          : null,
        afterId
          ? tx.workspaceColumn.findUnique({
              where: { id: afterId },
              select: { order: true },
            })
          : null,
      ]);

      if (before && after) {
        newOrder = Decimal.add(before.order, after.order).div(2);
      } else if (before) {
        newOrder = Decimal.add(before.order, 1000);
      } else if (after) {
        newOrder = Decimal.sub(after.order, 1000);
      } else {
        // Only column
        newOrder = new Decimal(1000);
      }

      const column = await tx.workspaceColumn.update({
        where: { id },
        data: {
          order: newOrder,
        },
      });

      return {
        success: true,
        workspaceId: column.workspaceId,
      };
    });

    return result;
  });
