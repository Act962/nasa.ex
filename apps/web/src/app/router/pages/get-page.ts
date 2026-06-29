import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/:id",
    summary: "Obter página NASA por id",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      include: {
        domainPurchase: true,
        // Pra UrlSlugEditor mostrar a URL completa de subpages
        // (`/s/<rootSlug>/<subSlug>`) — sem isso o front teria que
        // disparar 2ª query.
        parent: { select: { id: true, slug: true, title: true } },
      },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });
    return { page };
  });
