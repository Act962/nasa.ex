import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Deleta um grupo de tags. Tags filhas NÃO são apagadas — graças à FK
 * `onDelete: SetNull`, elas ficam com `tagGroupId = null` (= "Sem categoria").
 * UX: dialog de confirmação deve avisar "as N tags voltam pra Sem categoria".
 */
export const deleteTagGroup = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const group = await prisma.tagGroup.findUnique({
      where: { id: input.id },
      include: { _count: { select: { tags: true } } },
    });
    if (!group) {
      throw errors.NOT_FOUND({ message: "Grupo não encontrado" });
    }

    await prisma.tagGroup.delete({ where: { id: input.id } });

    return {
      id: input.id,
      name: group.name,
      orphanedTagCount: group._count.tags,
    };
  });
