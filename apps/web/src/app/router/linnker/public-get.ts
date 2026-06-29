import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getLinnkerPublic = base
  .route({
    method: "GET",
    path: "/public/linnker/:slug",
    summary: "Get a public Linnker page by slug",
  })
  .input(z.object({ slug: z.string() }))
  .handler(async ({ input, errors }) => {
    const page = await prisma.linnkerPage.findUnique({
      where: { slug: input.slug, isPublished: true },
      include: {
        links: {
          where: { isActive: true },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    return { page };
  });
