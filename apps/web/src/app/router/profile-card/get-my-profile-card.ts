import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

/**
 * Retorna o ProfileCard completo do usuário logado, incluindo TODOS
 * os toggles e skills/tools (diferente da rota pública que mascara).
 * Usado na tela de edição do próprio perfil.
 */
export const getMyProfileCard = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const card = await prisma.userProfileCard.findUnique({
      where: { userId: context.user.id },
      include: {
        skills: {
          include: { skill: true },
          orderBy: { createdAt: "asc" },
        },
        tools: {
          include: { tool: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return card;
  });
