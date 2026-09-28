import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findWorkspaceInOrg } from "../lib/workspace-access";

export const deleteWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await findWorkspaceInOrg(input.workspaceId, context.org.id);
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Workspace não encontrado" });
    }

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
