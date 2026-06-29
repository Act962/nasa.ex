import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Lista subpages de um site (top-level NasaPage), ordenadas por
 * `subpageOrder` (asc).
 *
 * Usado:
 *   - Aba "Páginas" do builder pra montar a lista navegável.
 *   - Properties-panel da navbar pra dropdown de "link interno".
 *   - Public renderer pra injetar siblings no contexto (navbar link).
 */
export const listSubpages = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/{parentPageId}/subpages",
    summary: "Listar subpages de um site",
  })
  .input(z.object({ parentPageId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    // Confirma que o parent é da org chamadora antes de devolver subpages.
    const parent = await prisma.nasaPage.findFirst({
      where: {
        id: input.parentPageId,
        organizationId,
        parentPageId: null,
      },
      select: { id: true },
    });
    if (!parent) {
      throw errors.NOT_FOUND({ message: "Site não encontrado" });
    }
    const subpages = await prisma.nasaPage.findMany({
      where: { parentPageId: parent.id },
      orderBy: [{ subpageOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        subpageOrder: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return { subpages };
  });
