import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createColumn = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      name: z.string(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const lastCol = await prisma.workspaceColumn.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { order: "desc" },
    });

    const newOrder = lastCol ? Number(lastCol.order) + 1 : 0;

    const column = await prisma.workspaceColumn.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        color: input.color,
        order: newOrder,
      },
    });

    return { column };
  });
