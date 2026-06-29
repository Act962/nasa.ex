import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Cor inválida (use #RRGGBB)");

export const updateTagGroup = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1).max(60).optional(),
      color: hexColor.optional(),
      icon: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const group = await prisma.tagGroup.findUnique({
      where: { id: input.id },
    });
    if (!group) {
      throw errors.NOT_FOUND({ message: "Grupo não encontrado" });
    }

    return await prisma.tagGroup.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.icon !== undefined && { icon: input.icon }),
      },
    });
  });
