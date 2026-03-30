import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

export const createColumn = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a column",
    tags: ["Column"],
  })
  .input(
    z.object({
      name: z.string(),
      color: z.string().optional(),
      workspaceId: z.string(),
    }),
  )
  .output(
    z.object({
      workspaceId: z.string(),
      columnName: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const lastColumn = await prisma.workspaceColumn.findFirst({
      where: {
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "desc",
      },
    });

    let newOrder: Decimal;

    newOrder = lastColumn
      ? new Decimal(lastColumn.order).plus(1000)
      : new Decimal(1000);

    const column = await prisma.workspaceColumn.create({
      data: {
        name: input.name,
        color: input.color,
        workspaceId: input.workspaceId,
        order: newOrder,
      },
    });

    return {
      columnName: column.name,
      workspaceId: column.workspaceId,
    };
  });
