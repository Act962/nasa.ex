import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateColumn = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      columnId: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
      order: z.number().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const column = await prisma.workspaceColumn.update({
      where: { id: input.columnId },
      data: {
        name: input.name,
        color: input.color,
        order: input.order,
      },
    });

    return { column };
  });
