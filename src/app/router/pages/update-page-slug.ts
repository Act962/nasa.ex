import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { slugSchema } from "./_schemas";

/**
 * Procedure dedicada pra trocar o slug de uma NasaPage.
 *
 * Separada do `updatePage` porque:
 *   1. Slug é parte da URL pública — tem que validar unicidade
 *      respeitando hierarquia (top-level único global, subpage único
 *      por parent).
 *   2. Mudar slug INVALIDA URL anterior. Próxima iteração pode criar
 *      redirect 301 antigo→novo, mas pra MVP o user assume risco.
 *
 * Comportamento:
 *   - Top-level (parentPageId NULL): slug único globalmente entre
 *     outros top-level (partial unique index do banco).
 *   - Subpage: slug único dentro do mesmo `parentPageId`.
 *   - O próprio id é ignorado na checagem de colisão (renomear pro
 *     mesmo slug atual é no-op, não dá erro).
 */
export const updatePageSlug = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/pages/{id}/slug",
    summary: "Atualizar slug da página (com validação de unicidade)",
  })
  .input(
    z.object({
      id: z.string(),
      slug: slugSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }

    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true, slug: true, parentPageId: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    // Sem mudança — no-op (evita query desnecessária).
    if (page.slug === input.slug) return { page };

    // Checa colisão respeitando hierarquia.
    const collision = await prisma.nasaPage.findFirst({
      where: {
        slug: input.slug,
        parentPageId: page.parentPageId, // NULL ou id do parent
        NOT: { id: page.id },
      },
      select: { id: true },
    });
    if (collision) {
      const scope =
        page.parentPageId == null
          ? "Já existe outro site com esse slug."
          : "Já existe uma subpage com esse slug neste site.";
      throw errors.BAD_REQUEST({ message: scope });
    }

    const updated = await prisma.nasaPage.update({
      where: { id: page.id },
      data: { slug: input.slug },
    });
    return { page: updated };
  });
