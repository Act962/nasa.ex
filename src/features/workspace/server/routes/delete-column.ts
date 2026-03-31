import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteColumn = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      columnId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    // Check for actions
    const hasActions = await prisma.action.findFirst({
      where: { columnId: input.columnId },
    });

    if (hasActions) {
      throw errors.FORBIDDEN({
        message:
          "Não é possível deletar uma coluna que possua tarefas vinculadas. Mova as tarefas primeiro.",
      });
    }

    const column = await prisma.workspaceColumn.delete({
      where: { id: input.columnId },
    });

    return { column };
  });
