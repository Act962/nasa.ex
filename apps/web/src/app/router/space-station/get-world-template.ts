import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Retorna o mapData completo de um template para aplicação local no cliente.
 * Permite templates públicos (qualquer um) ou privados (somente do autor).
 * Incrementa o contador de uso.
 */
export const getWorldTemplate = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/world-templates/:templateId",
    summary: "Fetch a world template's mapData for local application",
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
      select: {
        id:          true,
        name:        true,
        description: true,
        category:    true,
        previewUrl:  true,
        isPublic:    true,
        authorId:    true,
        mapData:     true,
      },
    });
    if (!tpl) throw errors.NOT_FOUND({ message: "Template não encontrado" });
    if (!tpl.isPublic && tpl.authorId !== userId) {
      throw errors.FORBIDDEN({ message: "Template privado" });
    }

    // Incrementa contador de uso em background (best-effort)
    prisma.worldTemplate
      .update({ where: { id: tpl.id }, data: { usedCount: { increment: 1 } } })
      .catch(() => { /* ignore */ });

    return { template: tpl };
  });
