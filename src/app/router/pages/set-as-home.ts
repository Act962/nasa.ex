import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Define uma subpage como nova "home" do site (top-level).
 *
 * Swap atômico:
 *   1. A subpage escolhida vira top-level (`parentPageId = NULL`).
 *      Mantém seu slug — passará a ser o slug "raiz" do site (`/s/<slug>`).
 *   2. O antigo top-level vira subpage da nova home:
 *      `parentPageId = <newRootId>`, `subpageOrder = <slot que a subpage
 *      escolhida ocupava>`.
 *
 * UX:
 *   - URL pública do site MUDA — o slug raiz é agora o da nova home.
 *     User deve ser avisado no client antes de confirmar.
 *   - Demais subpages permanecem como subpages (parent muda do antigo
 *     root pro novo root).
 */
export const setAsHome = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/{pageId}/set-as-home",
    summary: "Define uma subpage como home (root) do site",
  })
  .input(z.object({ pageId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }

    const newRoot = await prisma.nasaPage.findFirst({
      where: { id: input.pageId, organizationId },
      select: {
        id: true,
        parentPageId: true,
        subpageOrder: true,
      },
    });
    if (!newRoot) throw errors.NOT_FOUND({ message: "Página não encontrada" });
    if (newRoot.parentPageId == null) {
      // Já é root — nada a fazer.
      return { ok: true, alreadyHome: true };
    }

    const oldRootId = newRoot.parentPageId;
    const oldSubpageSlot = newRoot.subpageOrder ?? 0;

    // Pega todas as siblings da newRoot pra reassociar ao novo root.
    const siblings = await prisma.nasaPage.findMany({
      where: { parentPageId: oldRootId, NOT: { id: newRoot.id } },
      select: { id: true },
    });

    await prisma.$transaction([
      // 1. Promove a subpage a root.
      prisma.nasaPage.update({
        where: { id: newRoot.id },
        data: { parentPageId: null, subpageOrder: null },
      }),
      // 2. Antigo root vira subpage no slot que a nova home ocupava.
      prisma.nasaPage.update({
        where: { id: oldRootId },
        data: { parentPageId: newRoot.id, subpageOrder: oldSubpageSlot },
      }),
      // 3. Reassocia siblings ao novo root (mantêm seus subpageOrder).
      ...siblings.map((sibling) =>
        prisma.nasaPage.update({
          where: { id: sibling.id },
          data: { parentPageId: newRoot.id },
        }),
      ),
    ]);

    return { ok: true };
  });
