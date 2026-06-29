import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista pública de skills (autocomplete). Não precisa de auth —
 * é apenas o catálogo read-only.
 */
export const listSkillCatalog = base
  .input(
    z
      .object({
        query: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
      .optional(),
  )
  .handler(async ({ input }) => {
    const where = input?.query
      ? {
          OR: [
            { name: { contains: input.query, mode: "insensitive" as const } },
            { slug: { contains: input.query, mode: "insensitive" as const } },
          ],
        }
      : {};

    const skills = await prisma.skill.findMany({
      where,
      orderBy: { name: "asc" },
      take: input?.limit ?? 50,
      select: { id: true, name: true, slug: true },
    });

    return skills;
  });
