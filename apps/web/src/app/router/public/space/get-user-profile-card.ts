import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  PUBLIC_USER_SELECT,
  filterProfileCardByToggles,
} from "@/features/space-page/utils/public-selectors";

/**
 * Retorna o UserProfileCard de um usuário respeitando os toggles
 * granulares (§7.1 e §7.2 do plano). Se `isPublic=false`, devolve
 * apenas o básico (id/name/image). Nunca expõe email de login,
 * phone, session, etc.
 */
export const getUserProfileCard = base
  .input(z.object({ userId: z.string().min(1) }))
  .handler(async ({ input, errors }) => {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: PUBLIC_USER_SELECT,
    });

    if (!user) {
      throw errors.NOT_FOUND({ message: "Usuário não encontrado." });
    }

    const card = await prisma.userProfileCard.findUnique({
      where: { userId: input.userId },
      select: {
        id: true,
        headline: true,
        bio: true,
        cvUrl: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        email: true,
        isPublic: true,
        showHeadline: true,
        showBio: true,
        showCv: true,
        showLinkedin: true,
        showGithub: true,
        showPortfolio: true,
        showEmail: true,
        showSkills: true,
        showTools: true,
        skills: {
          select: {
            level: true,
            skill: { select: { id: true, name: true, slug: true } },
          },
        },
        tools: {
          select: {
            proficiency: true,
            tool: {
              select: { id: true, name: true, slug: true, iconUrl: true },
            },
          },
        },
      },
    });

    // Sem card = sem perfil público
    if (!card || !card.isPublic) {
      return {
        user,
        card: null,
        skills: [],
        tools: [],
      };
    }

    const safeFields = filterProfileCardByToggles(card);

    return {
      user,
      card: safeFields,
      skills: card.showSkills ? card.skills : [],
      tools: card.showTools ? card.tools : [],
    };
  });
