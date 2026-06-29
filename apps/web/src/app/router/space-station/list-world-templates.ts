import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { TemplateCategory } from "@/generated/prisma/enums";
import z from "zod";

export const listWorldTemplates = base
  .use(optionalAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/world-templates",
    summary: "List public world templates with optional filter",
  })
  .input(
    z.object({
      category:        z.nativeEnum(TemplateCategory).optional(),
      search:          z.string().max(100).optional(),
      excludeMine:     z.coerce.boolean().optional(),
      limit:           z.coerce.number().int().min(1).max(50).optional(),
      offset:          z.coerce.number().int().min(0).optional(),
    }).optional(),
  )
  .handler(async ({ input, context }) => {
    // oRPC RPCLink pode serializar {} como undefined — aceitamos ambos
    const { category, search, excludeMine, limit = 24, offset = 0 } = input ?? {};
    const userId = context.user?.id;
    const templates = await prisma.worldTemplate.findMany({
      where: {
        isPublic: true,
        ...(excludeMine && userId ? { authorId: { not: userId } } : {}),
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
        createdAt:   true,
        author: { select: { id: true, name: true, image: true } },
      },
      orderBy: { usedCount: "desc" },
      take:  limit,
      skip:  offset,
    });
    return { templates };
  });
