import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista as sessões "livres" do usuário (sem `context` — embeds não aparecem).
 * Usado pelo /home → componente `recent-requests`.
 */
export const listAstroSessions = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/astro/sessions/list",
    summary: "List user's free ASTRO sessions",
  })
  .input(
    z.object({
      take: z.number().min(1).max(100).default(30),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    // Sessões "livres" = não vinculadas a uma entidade específica (lead,
    // conversation, action). Antes filtrávamos `context: { equals: null }`,
    // mas o cliente sempre passa `{ pathname: "/home" }` no Explorer — então
    // todas as sessões caíam fora desse filtro e a lista vinha vazia.
    //
    // Agora aceita qualquer sessão SEM ids de entidade no context (pathname
    // sozinho conta como "livre"). Embeds (que setam conversationId/leadId)
    // continuam fora.
    const sessionsRaw = await prisma.aiSession.findMany({
      where: {
        userId: context.user.id,
        organizationId,
      },
      orderBy: { updatedAt: "desc" },
      take: input.take * 3, // sobra pra filtrar embeds antes de cortar
      select: {
        id: true,
        title: true,
        lastAgentKey: true,
        updatedAt: true,
        createdAt: true,
        context: true,
      },
    });

    const isEmbedContext = (c: unknown): boolean => {
      if (!c || typeof c !== "object") return false;
      const obj = c as Record<string, unknown>;
      return Boolean(
        obj.conversationId || obj.leadId || obj.actionId || obj.workspaceId,
      );
    };

    const sessions = sessionsRaw
      .filter((s) => !isEmbedContext(s.context))
      .slice(0, input.take)
      .map(({ context: _ctx, ...rest }) => rest);

    return { sessions };
  });
