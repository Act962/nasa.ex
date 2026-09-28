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
      where: {
        id: { in: input.actionIds },
        workspace: { organizationId: context.org.id },
      },
      select: { id: true, isArchived: true, createdBy: true },
    });

    // Algum id não pertence à org (sumiu do resultado) ou viola a regra de
    // dono/arquivada → recusa o lote inteiro.
    if (actions.length !== input.actionIds.length) {
      throw errors.NOT_FOUND({ message: "Ação não encontrada" });
    }

    const forbidden = actions.find(
      (action) => !action.isArchived || action.createdBy !== context.user.id,
    );

    if (forbidden) {
      throw errors.FORBIDDEN({
        message: "Só é possível deletar ações arquivadas e criadas por você.",
      });
    }

    await prisma.action.deleteMany({
      where: {
        id: { in: input.actionIds },
        workspace: { organizationId: context.org.id },
      },
    });

    return { success: true };
  });
