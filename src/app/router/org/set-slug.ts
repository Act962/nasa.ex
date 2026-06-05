import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Define o slug da organização. Usado quando a org foi criada sem
 * slug (orgs antigas, importadas, etc) e o user precisa de slug pra
 * features públicas — In-Chat (/whatsapp/<slug>), NASA Pages chat-
 * button, Linnker.
 *
 * Validações:
 * - Formato: `^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$` (3-32 chars,
 *   lowercase, dígitos, hífens; não pode começar/terminar com hífen)
 * - Unicidade: rejeita se outra org já usa esse slug
 * - Bloqueia overwrite — se a org já tem slug, retorna erro pra
 *   evitar quebrar links existentes (mudança de slug = URL diferente
 *   de tudo que aponta pra essa org).
 */
export const setOrgSlug = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      slug: z
        .string()
        .min(3)
        .max(32)
        .regex(
          /^[a-z0-9][a-z0-9-]+[a-z0-9]$/,
          "Slug inválido (use letras minúsculas, números e hífens)",
        ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const currentSlug = (context.org as { slug?: string | null }).slug;
    if (currentSlug) {
      throw errors.BAD_REQUEST({
        message:
          "Esta organização já tem slug configurado. Pra alterar, contate o suporte.",
      });
    }

    // Checa colisão com outras orgs
    const collision = await prisma.organization.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (collision && collision.id !== context.org.id) {
      throw errors.BAD_REQUEST({
        message: `Slug "${input.slug}" já está em uso por outra organização. Escolha outro.`,
      });
    }

    const org = await prisma.organization.update({
      where: { id: context.org.id },
      data: { slug: input.slug },
      select: { id: true, slug: true, name: true },
    });

    return { organization: org };
  });
