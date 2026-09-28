import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findWorkspaceInOrg } from "../lib/workspace-access";
import { isOrgMember } from "@/features/actions/server/lib/action-access";

export const addWorkspaceMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      userId: z.string(),
      role: z.enum(["OWNER", "MEMBER", "VIEWER"]).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const workspace = await findWorkspaceInOrg(input.workspaceId, context.org.id);
    if (!workspace) {
      throw errors.NOT_FOUND({ message: "Workspace não encontrado" });
    }

    // Alvo tem que ser da mesma org — sem isso dá pra plugar qualquer usuário
    // da plataforma (ou a si mesmo em workspace alheio) via id cru.
    if (!(await isOrgMember(input.userId, context.org.id))) {
      throw errors.FORBIDDEN({
        message: "Usuário não pertence a esta organização",
      });
    }

    const member = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: input.userId,
        },
      },
      update: {
        role: input.role,
      },
      create: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.role ?? "MEMBER",
      },
    });

    return { member };
  });
