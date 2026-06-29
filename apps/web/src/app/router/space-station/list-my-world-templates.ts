import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { TemplateCategory } from "@/generated/prisma/enums";
import z from "zod";

/**
 * Lista todos os templates de mundo do usuário autenticado
 * (inclui privados e públicos do próprio usuário).
 */
export const listMyWorldTemplates = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/world-templates/mine",
    summary: "List my own world templates (public and private)",
  })
  .input(
    z.object({
      category: z.nativeEnum(TemplateCategory).optional(),
      search:   z.string().max(100).optional(),
      limit:    z.coerce.number().int().min(1).max(50).optional(),
      offset:   z.coerce.number().int().min(0).optional(),
    }).optional(),
  )
  .handler(async ({ input, context }) => {
    // oRPC RPCLink pode serializar {} como undefined — aceitamos ambos
    const { category, search, limit = 50, offset = 0 } = input ?? {};
    const userId = context.user.id;
    const templates = await prisma.worldTemplate.findMany({
      where: {
        authorId: userId,
        ...(category ? { category } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        id:          true,
        name:        true,
        description: true,
        category:    true,
        previewUrl:  true,
        usedCount:   true,
        isPublic:    true,
        createdAt:   true,
        author: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take:  limit,
      skip:  offset,
    });
    return { templates };
  });
