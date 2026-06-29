import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { slugify } from "@/lib/utils";

export const updateTag = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      tagId: z.string(),
      name: z.string(),
      color: z.string(),
      description: z.string().trim().nullable().optional(),
      /** Mover tag pra um grupo (id) ou tirá-la (null = "Sem categoria"). */
      tagGroupId: z.string().nullable().optional(),
      /** Restaura tag arquivada (zera archivedAt). Quando true, ignora os
       *  outros campos editáveis e só faz a restauração. */
      restore: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const tag = await prisma.tag.findUnique({
      where: {
        id: input.tagId,
      },
    });

    if (!tag) {
      throw errors.BAD_REQUEST({
        message: "Tag não encontrada",
      });
    }

    // Modo "restaurar": zera archivedAt + archivedById e sai. Não toca em
    // name/color — preserva o estado da tag antes do arquivamento.
    if (input.restore) {
      return await prisma.tag.update({
        where: { id: input.tagId },
        data: { archivedAt: null, archivedById: null },
      });
    }

    const slug = slugify(input.name);

    return await prisma.tag.update({
      where: {
        id: input.tagId,
      },
      data: {
        name: input.name,
        slug: slug,
        color: input.color,
        ...(input.description !== undefined && { description: input.description }),
        ...(input.tagGroupId !== undefined && { tagGroupId: input.tagGroupId }),
      },
    });
  });
