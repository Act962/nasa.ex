import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.action.findUnique({
      where: { id: input.actionId },
      select: { isArchived: true, createdBy: true },
    });

    if (!existing) {
      throw errors.NOT_FOUND;
    }

    if (!existing.isArchived || existing.createdBy !== context.user.id) {
      throw errors.FORBIDDEN;
    }

    const action = await prisma.action.delete({
      where: { id: input.actionId },
    });

    return { action };
  });
