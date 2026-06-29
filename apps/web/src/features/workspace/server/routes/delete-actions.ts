import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteActions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionIds: z.array(z.string()) }))
  .handler(async ({ input, context, errors }) => {
    const actions = await prisma.action.findMany({
      where: { id: { in: input.actionIds } },
      select: { id: true, isArchived: true, createdBy: true },
    });

    const forbidden = actions.find(
      (a) => !a.isArchived || a.createdBy !== context.user.id,
    );

    if (forbidden) {
      throw errors.FORBIDDEN({
        message: "Só é possível deletar ações arquivadas e criadas por você.",
      });
    }

    await prisma.action.deleteMany({
      where: { id: { in: input.actionIds } },
    });

    return { success: true };
  });
