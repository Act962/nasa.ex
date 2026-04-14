import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const removeWorkspaceMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { user, org } = context;

    // Buscar informações do membro a ser removido e do solicitante para validação de permissões
    const [memberToBeRemoved, callerWorkspaceMember, callerOrgMember] =
      await Promise.all([
        prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: input.workspaceId,
              userId: input.userId,
            },
          },
        }),
        prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: input.workspaceId,
              userId: user.id,
            },
          },
        }),
        prisma.member.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: org.id,
            },
          },
        }),
      ]);

    if (!memberToBeRemoved) {
      throw new Error("Membro não encontrado");
    }

    // Lógica de autorização:
    // 1. Dono do Workspace (OWNER)
    // 2. Dono da Organização (owner)
    // 3. Admin da Organização (admin)
    const isWorkspaceOwner = callerWorkspaceMember?.role === "OWNER";
    const isOrgPrivileged =
      callerOrgMember?.role === "owner" || callerOrgMember?.role === "admin";

    if (!isWorkspaceOwner && !isOrgPrivileged) {
      throw new Error(
        "Você não tem permissão para remover membros deste workspace",
      );
    }

    // Trava de segurança: não é possível remover o dono do próprio workspace
    if (memberToBeRemoved.role === "OWNER") {
      throw new Error("Não é possível remover o dono do workspace");
    }

    const member = await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: input.userId,
        },
      },
    });

    return { member };
  });
