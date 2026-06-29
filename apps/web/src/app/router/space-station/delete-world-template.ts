import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Exclui um ambiente salvo pelo próprio usuário (autor).
 * Somente o autor pode excluir — outros usuários recebem FORBIDDEN.
 */
export const deleteWorldTemplate = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    path: "/space-station/world-templates/:templateId",
    summary: "Delete a world template (author only)",
  })
  .input(
    z.object({
      templateId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const userId = context.user.id;
    const tpl = await prisma.worldTemplate.findUnique({
      where: { id: input.templateId },
      select: { id: true, authorId: true },
    });
    if (!tpl) throw errors.NOT_FOUND({ message: "Ambiente não encontrado" });
    if (tpl.authorId !== userId) {
      throw errors.FORBIDDEN({ message: "Apenas o autor pode excluir este ambiente" });
    }
    await prisma.worldTemplate.delete({ where: { id: tpl.id } });
    return { success: true };
  });
