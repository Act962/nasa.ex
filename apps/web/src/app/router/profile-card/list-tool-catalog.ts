import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista pública de ferramentas (autocomplete).
 */
export const listToolCatalog = base
  .input(
    z
      .object({
        query: z.string().max(100).optional(),
        category: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
      .optional(),
  )
  .handler(async ({ input }) => {
    const where = {
      ...(input?.query
        ? {
            OR: [
              { name: { contains: input.query, mode: "insensitive" as const } },
              { slug: { contains: input.query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(input?.category ? { category: input.category } : {}),
    };

    const tools = await prisma.toolCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      take: input?.limit ?? 50,
      select: {
        id: true,
        name: true,
        slug: true,
        iconUrl: true,
        category: true,
      },
    });

    return tools;
  });
