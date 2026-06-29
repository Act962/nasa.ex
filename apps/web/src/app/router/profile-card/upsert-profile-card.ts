import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

/**
 * Cria ou atualiza o UserProfileCard do usuário logado.
 * Um usuário tem no máximo 1 card (unique em userId).
 *
 * Todos os toggles granulares são editáveis — segurança máxima:
 * o usuário escolhe exatamente quais campos ficam públicos.
 */
export const upsertProfileCard = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      headline: z.string().max(120).nullable().optional(),
      bio: z.string().max(500).nullable().optional(),
      cvUrl: z.string().url().nullable().optional(),
      linkedinUrl: z.string().url().nullable().optional(),
      githubUrl: z.string().url().nullable().optional(),
      portfolioUrl: z.string().url().nullable().optional(),
      email: z.string().email().nullable().optional(),

      isPublic: z.boolean().optional(),
      showHeadline: z.boolean().optional(),
      showBio: z.boolean().optional(),
      showCv: z.boolean().optional(),
      showLinkedin: z.boolean().optional(),
      showGithub: z.boolean().optional(),
      showPortfolio: z.boolean().optional(),
      showEmail: z.boolean().optional(),
      showSkills: z.boolean().optional(),
      showTools: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    // Remove undefineds para não zerar campos não enviados
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) data[k] = v;
    }

    const card = await prisma.userProfileCard.upsert({
      where: { userId: context.user.id },
      create: {
        userId: context.user.id,
        ...data,
      },
      update: data,
    });

    return card;
  });
