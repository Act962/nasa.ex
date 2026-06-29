import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { astroRouteContextSchema } from "@/features/astro/schemas/chat-message";
import { z } from "zod";

/**
 * Cria uma `AiSession` vazia. O cliente chama isto **antes** de mandar a
 * primeira mensagem para `/api/astro/chat`, e passa o `sessionId` retornado
 * no body da requisição. Esse padrão evita ter que extrair o id de dentro do
 * stream e mantém o `useChat` simples.
 *
 * - `context`: snapshot da rota (orgId, leadId, etc). null/undefined = sessão
 *   livre, aparece no /home recents.
 */
export const createAstroSession = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/astro/sessions/create",
    summary: "Create an empty ASTRO session",
  })
  .input(
    z.object({
      context: astroRouteContextSchema.optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const session = await prisma.aiSession.create({
      data: {
        organizationId,
        userId: context.user.id,
        messages: [],
        context: input.context ? (input.context as object) : undefined,
      },
      select: { id: true },
    });

    return { id: session.id };
  });
