import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Reordena as subpages de um site. Recebe a NOVA ordem dos IDs
 * (do topo pro fim) e atualiza `subpageOrder` em batch.
 *
 * Validação anti-acidente: confere se TODOS os IDs pertencem ao
 * mesmo parent. Sem isso, um payload malicioso poderia "mover"
 * subpage de outro site.
 */
export const reorderSubpages = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/pages/{parentPageId}/subpages/order",
    summary: "Reordenar subpages de um site",
  })
  .input(
    z.object({
      parentPageId: z.string().min(1),
      orderedIds: z.array(z.string().min(1)).min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }

    const parent = await prisma.nasaPage.findFirst({
      where: {
        id: input.parentPageId,
        organizationId,
        parentPageId: null,
      },
      select: { id: true },
    });
    if (!parent) throw errors.NOT_FOUND({ message: "Site não encontrado" });

    // Confere que todos os IDs do payload SÃO subpages do mesmo parent.
    const subpages = await prisma.nasaPage.findMany({
      where: { parentPageId: parent.id, id: { in: input.orderedIds } },
      select: { id: true },
    });
    if (subpages.length !== input.orderedIds.length) {
      throw errors.BAD_REQUEST({
        message: "Lista de IDs inclui página que não é subpage deste site",
      });
    }

    // Atualiza em transação pra evitar estado intermediário inconsistente.
    await prisma.$transaction(
      input.orderedIds.map((id, idx) =>
        prisma.nasaPage.update({
          where: { id },
          data: { subpageOrder: idx },
        }),
      ),
    );
    return { ok: true };
  });
