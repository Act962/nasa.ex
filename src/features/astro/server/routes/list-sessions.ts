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

    const sessions = await prisma.aiSession.findMany({
      where: {
        userId: context.user.id,
        organizationId,
        context: { equals: null as never }, // null JSON = sessão livre
      },
      orderBy: { updatedAt: "desc" },
      take: input.take,
      select: {
        id: true,
        title: true,
        lastAgentKey: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return { sessions };
  });
