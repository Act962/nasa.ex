import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

/**
 * Adiciona uma Tool (IDE, Figma, Notion, etc.) ao ProfileCard.
 */
export const addTool = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      toolId: z.string().min(1),
      proficiency: z.number().int().min(1).max(5).optional().default(3),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const tool = await prisma.toolCatalog.findUnique({
      where: { id: input.toolId },
      select: { id: true },
    });
    if (!tool) throw errors.BAD_REQUEST({ message: "Ferramenta inválida." });

    const card = await prisma.userProfileCard.upsert({
      where: { userId: context.user.id },
      create: { userId: context.user.id },
      update: {},
      select: { id: true },
    });

    const userTool = await prisma.userTool.upsert({
      where: {
        profileId_toolId: { profileId: card.id, toolId: tool.id },
      },
      create: {
        profileId: card.id,
        toolId: tool.id,
        proficiency: input.proficiency ?? 3,
      },
      update: { proficiency: input.proficiency ?? 3 },
    });

    return userTool;
  });
