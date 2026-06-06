import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { emptyLayout, slugSchema } from "./_schemas";

/**
 * Cria uma SUBPAGE dentro de um site (NasaPage top-level).
 *
 * Diferenças vs `createPage`:
 *   - NÃO cobra Stars (subpages são "filhas" do site já pago).
 *   - Slug é único dentro do mesmo parent (não global) — partial
 *     unique index `nasa_pages_subpage_slug_key` garante.
 *   - Herda palette/fontFamily/layerCount do parent — UX consistente.
 *   - `subpageOrder` = max atual + 1 pra ficar no fim da lista.
 *   - Layout vazio (user constrói do zero, ou clona via "duplicar").
 */
export const createSubpage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/subpages",
    summary: "Criar subpage dentro de um site existente",
  })
  .input(
    z.object({
      parentPageId: z.string().min(1),
      title: z.string().min(1).max(200),
      slug: slugSchema,
      description: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }

    // Valida parent: existe, mesma org, é top-level (não permitimos
    // sub-subpages — hierarquia profunda fica fora de escopo).
    const parent = await prisma.nasaPage.findFirst({
      where: {
        id: input.parentPageId,
        organizationId,
        parentPageId: null,
      },
      select: {
        id: true,
        layerCount: true,
        palette: true,
        fontFamily: true,
      },
    });
    if (!parent) {
      throw errors.NOT_FOUND({
        message: "Site não encontrado (ou já é uma subpage)",
      });
    }

    // Checa colisão de slug DENTRO do mesmo parent.
    const taken = await prisma.nasaPage.findFirst({
      where: { parentPageId: parent.id, slug: input.slug },
      select: { id: true },
    });
    if (taken) {
      throw errors.BAD_REQUEST({
        message: "Já existe uma página com esse slug no site",
      });
    }

    // Próxima ordem = max + 1 (push to end).
    const maxOrder = await prisma.nasaPage.aggregate({
      where: { parentPageId: parent.id },
      _max: { subpageOrder: true },
    });
    const nextOrder = (maxOrder._max.subpageOrder ?? -1) + 1;

    const layerCount = parent.layerCount === 2 ? 2 : 1;
    const subpage = await prisma.nasaPage.create({
      data: {
        organizationId,
        userId: context.user.id,
        title: input.title,
        slug: input.slug,
        description: input.description,
        intent: "CUSTOM",
        layerCount,
        palette: (parent.palette ?? {}) as object,
        fontFamily: parent.fontFamily ?? null,
        layout: emptyLayout(layerCount as 1 | 2) as object,
        parentPageId: parent.id,
        subpageOrder: nextOrder,
      },
    });

    return { subpage };
  });
