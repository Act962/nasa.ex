import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Hidrata uma sessão completa para o `useChat` reabrir o histórico.
 * Valida ownership via `userId` + `organizationId` ativa.
 */
export const getAstroSession = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/astro/sessions/get",
    summary: "Get an ASTRO session with full message history",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const session = await prisma.aiSession.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        title: true,
        messages: true,
        context: true,
        lastAgentKey: true,
        userId: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (
      !session ||
      session.userId !== context.user.id ||
      session.organizationId !== organizationId
    ) {
      throw errors.NOT_FOUND();
    }

    return { session };
  });
