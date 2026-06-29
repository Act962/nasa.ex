import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const getFeature = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      categorySlug: z.string(),
      featureSlug: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const category = await prisma.spaceHelpCategory.findUnique({
      where: { slug: input.categorySlug },
      select: { id: true, slug: true, name: true, description: true, iconKey: true },
    });
    if (!category) throw new ORPCError("NOT_FOUND", { message: "Categoria não encontrada" });

    const feature = await prisma.spaceHelpFeature.findUnique({
      where: { categoryId_slug: { categoryId: category.id, slug: input.featureSlug } },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
    });
    if (!feature) throw new ORPCError("NOT_FOUND", { message: "Funcionalidade não encontrada" });

    return { category, feature };
  });
