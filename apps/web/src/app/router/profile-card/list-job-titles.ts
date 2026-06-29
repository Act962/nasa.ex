import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista pública do JobTitleCatalog (dropdown do organograma).
 * Não precisa auth — empresas filtram pelo que querem exibir.
 */
export const listJobTitles = base
  .input(
    z
      .object({
        category: z
          .enum([
            "EXECUTIVE",
            "TECH",
            "DESIGN",
            "PRODUCT",
            "MARKETING",
            "SALES",
            "OPERATIONS",
            "FINANCE",
            "HR",
            "LEGAL",
            "OTHER",
          ])
          .optional(),
        query: z.string().max(100).optional(),
      })
      .optional(),
  )
  .handler(async ({ input }) => {
    const where = {
      ...(input?.category ? { category: input.category } : {}),
      ...(input?.query
        ? { title: { contains: input.query, mode: "insensitive" as const } }
        : {}),
    };

    const titles = await prisma.jobTitleCatalog.findMany({
      where,
      orderBy: [{ level: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        level: true,
      },
    });

    return titles;
  });
