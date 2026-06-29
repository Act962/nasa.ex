import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    // Check for actions
    const hasActions = await prisma.action.findFirst({
      where: { workspaceId: input.workspaceId },
      select: { id: true },
    });

    if (hasActions) {
      throw errors.FORBIDDEN({
        message:
          "Não é possível deletar um workspace que possua ações vinculadas. Deletar ações primeiro.",
      });
    }

    const workspace = await prisma.workspace.delete({
      where: { id: input.workspaceId },
    });

    return { workspace };
  });
