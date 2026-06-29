import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getPagePublicByDomain = base
  .route({
    method: "GET",
    path: "/public/pages/by-domain/:host",
    summary: "Obter página pública por domínio custom",
  })
  .input(z.object({ host: z.string() }))
  .handler(async ({ input, errors }) => {
    const host = input.host.toLowerCase();
    const page = await prisma.nasaPage.findFirst({
      where: {
        customDomain: host,
        status: "PUBLISHED",
        domainStatus: "VERIFIED",
      },
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
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada neste domínio" });
    return { page };
  });
