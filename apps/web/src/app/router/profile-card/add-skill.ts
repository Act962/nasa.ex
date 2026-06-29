import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

/**
 * Adiciona uma Skill ao ProfileCard do usuário logado.
 * Se o usuário ainda não tem ProfileCard, cria um vazio (isPublic=false
 * por default, então nada vaza).
 */
export const addSkill = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      skillId: z.string().min(1),
      level: z.number().int().min(1).max(5).optional().default(3),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const skill = await prisma.skill.findUnique({
      where: { id: input.skillId },
      select: { id: true },
    });
    if (!skill) throw errors.BAD_REQUEST({ message: "Skill inválida." });

    const card = await prisma.userProfileCard.upsert({
      where: { userId: context.user.id },
      create: { userId: context.user.id },
      update: {},
      select: { id: true },
    });

    const userSkill = await prisma.userSkill.upsert({
      where: {
        profileId_skillId: { profileId: card.id, skillId: skill.id },
      },
      create: {
        profileId: card.id,
        skillId: skill.id,
        level: input.level ?? 3,
      },
      update: { level: input.level ?? 3 },
    });

    return userSkill;
  });
