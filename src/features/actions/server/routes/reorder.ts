import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const reorderAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      columnId: z.string(),
      order: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const action = await prisma.action.update({
      where: { id: input.id },
      data: {
        columnId: input.columnId,
        order: new Prisma.Decimal(input.order),
      },
    });

    return { action };
  });
