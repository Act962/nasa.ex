import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Busca pública: cursos e organizações por nome.
 * Usado na home `/nasa-route` (catálogo geral) e na busca pública.
 */
export const publicSearch = base
  .input(
    z.object({
      query: z.string().trim().max(100).optional(),
      categoryId: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(24),
    }),
  )
  .handler(async ({ input }) => {
    const { query, categoryId, limit } = input;

    const courses = await prisma.nasaRouteCourse.findMany({
      where: {
        isPublished: true,
        isArchived: false, // esconde cursos/eventos arquivados (cron auto-archive)
        ...(categoryId ? { categoryId } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { subtitle: { contains: query, mode: "insensitive" } },
                { creatorOrg: { name: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ studentsCount: "desc" }, { publishedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverUrl: true,
        level: true,
        durationMin: true,
        format: true,
        priceStars: true,
        studentsCount: true,
        // Datas UNIFICADAS — válidas pra qualquer formato. UI mostra
        // badge na capa do card quando preenchidas.
        startsAt: true,
        endsAt: true,
        // Datas LEGADAS (format = "event") — preservadas pra compat
        // com cursos antigos que não tinham startsAt/endsAt.
        eventStartsAt: true,
        eventEndsAt: true,
        eventTimezone: true,
        creatorOrg: { select: { id: true, name: true, slug: true, logo: true } },
        category: { select: { id: true, slug: true, name: true } },
      },
    });

    const categories = await prisma.nasaRouteCategory.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, slug: true, name: true, iconKey: true, description: true },
    });

    return { courses, categories };
  });
