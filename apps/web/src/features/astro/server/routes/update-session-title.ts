import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Renomeia uma sessão do Astro (mostrada no painel "Históricos Astro
 * Explorer"). Permite o user customizar o título auto-gerado.
 *
 * Verifica owner (user + org) antes de gravar.
 */
export const updateAstroSessionTitle = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/astro/sessions/update-title",
    summary: "Update title of an ASTRO session",
  })
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).max(120),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const session = await prisma.aiSession.findUnique({
      where: { id: input.id },
      select: { userId: true, organizationId: true },
    });
    if (
      !session ||
      session.userId !== context.user.id ||
      session.organizationId !== organizationId
    ) {
      throw errors.NOT_FOUND();
    }

    const updated = await prisma.aiSession.update({
      where: { id: input.id },
      data: { title: input.title.trim() },
      select: { id: true, title: true },
    });
    return updated;
  });
