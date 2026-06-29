import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const removeParticipant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const action = await prisma.action.findUnique({
      where: {
        id: input.actionId,
      },
      select: {
        id: true,
        createdBy: true,
      },
    });

    if (!action) {
      throw errors.NOT_FOUND({ message: "Ação não encontrada" });
    }

    const callerOrgMember = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: context.user.id,
          organizationId: context.org.id,
        },
      },
    });

    const isActionCreator = action.createdBy === context.user.id;
    const isOrgPrivileged =
      callerOrgMember?.role === "owner" ||
      callerOrgMember?.role === "admin" ||
      callerOrgMember?.role === "moderador";

    if (!isActionCreator && !isOrgPrivileged) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para remover um participante",
      });
    }

    if (action.createdBy === input.userId) {
      throw errors.BAD_REQUEST({
        message: "O criador da ação não pode ser removido dos participantes",
      });
    }

    const participant = await prisma.actionsUserParticipant.delete({
      where: {
        actionId_userId: {
          actionId: input.actionId,
          userId: input.userId,
        },
      },
      include: {
        action: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    return { participant };
  });
