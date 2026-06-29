import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getPagePublic = base
  .route({
    method: "GET",
    path: "/public/pages/:slug",
    summary: "Obter página pública publicada por slug (sem auth)",
  })
  .input(z.object({ slug: z.string() }))
  .handler(async ({ input, errors }) => {
    const page = await prisma.nasaPage.findFirst({
      where: { slug: input.slug, status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        faviconUrl: true,
        ogImageUrl: true,
        publishedLayout: true,
        layerCount: true,
        palette: true,
        fontFamily: true,
        organizationId: true,
        userId: true,
      },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });
    return { page };
  });
