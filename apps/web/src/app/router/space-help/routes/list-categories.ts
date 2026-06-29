import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

export const listCategories = base
  .use(requiredAuthMiddleware)
  .handler(async () => {
    const categories = await prisma.spaceHelpCategory.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
      include: {
        features: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            youtubeUrl: true,
            order: true,
            _count: { select: { steps: true } },
            steps: {
              orderBy: { order: "asc" },
              take: 1,
              select: { screenshotUrl: true },
            },
          },
        },
      },
    });
    return { categories };
  });
