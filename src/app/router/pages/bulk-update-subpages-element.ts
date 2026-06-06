import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { elementSchema } from "./_schemas";
import type { PageLayout, ElementBase } from "@/features/pages/types";

/**
 * Aplica um elemento (geralmente section-navbar ou section-footer) em
 * TODAS as páginas do site (root + subpages). Comportamento "snapshot
 * copy": clona o `element` e:
 *   - Substitui qualquer ocorrência do mesmo tipo existente nas
 *     páginas-alvo, OU
 *   - Adiciona no topo (pra navbar) / fim (pra footer) caso a página
 *     não tenha aquele tipo ainda.
 *
 * NÃO cria conceito de "global component" no schema — cada página
 * mantém sua cópia independente do elemento. Próxima sprint pode
 * evoluir pra global components reais (Webflow-style), mas pra MVP
 * essa abordagem entrega o "edita uma navbar e reflete em todas" sem
 * mexer no schema.
 */
export const bulkUpdateSubpagesElement = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/{parentPageId}/bulk-element",
    summary: "Aplica um elemento em todas as páginas (root + subpages) do site",
  })
  .input(
    z.object({
      parentPageId: z.string().min(1),
      element: elementSchema,
      /** Se true, também aplica no próprio root (caller passa parent
       *  como o root atual e quer espalhar pra todas as irmãs + ele).
       *  Default true. */
      includeRoot: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }

    const root = await prisma.nasaPage.findFirst({
      where: {
        id: input.parentPageId,
        organizationId,
        parentPageId: null,
      },
      select: { id: true },
    });
    if (!root) throw errors.NOT_FOUND({ message: "Site não encontrado" });

    const targets = await prisma.nasaPage.findMany({
      where: input.includeRoot
        ? {
            OR: [
              { id: root.id },
              { parentPageId: root.id },
            ],
          }
        : { parentPageId: root.id },
      select: { id: true, layout: true },
    });

    const elementType = input.element.type;
    // Aplica no layout de cada page: se já tem aquele type, substitui;
    // senão, adiciona (navbar no topo, footer no fim, outros casos no
    // fim por default).
    await prisma.$transaction(
      targets.map((page) => {
        const layout = page.layout as unknown as PageLayout;
        const updated = mergeElementIntoLayout(layout, input.element as ElementBase);
        return prisma.nasaPage.update({
          where: { id: page.id },
          data: { layout: updated as object },
        });
      }),
    );

    return { ok: true, affected: targets.length, elementType };
  });

function mergeElementIntoLayout(
  layout: PageLayout,
  element: ElementBase,
): PageLayout {
  const cloneId = `el_${Math.random().toString(36).slice(2, 12)}`;
  const cloned: ElementBase = { ...element, id: cloneId };

  if (layout.mode === "single") {
    const els = (layout.main?.elements ?? []) as ElementBase[];
    const merged = mergeElementArray(els, cloned);
    return { ...layout, main: { ...layout.main, elements: merged } };
  }
  // Stacked: aplica no `front` (layer principal).
  const els = (layout.front?.elements ?? []) as ElementBase[];
  const merged = mergeElementArray(els, cloned);
  return { ...layout, front: { ...layout.front, elements: merged } };
}

function mergeElementArray(
  existing: ElementBase[],
  next: ElementBase,
): ElementBase[] {
  const existingOfType = existing.findIndex((el) => el.type === next.type);
  if (existingOfType >= 0) {
    // Replace in-place, mantendo o id do já existente pra não quebrar
    // refs externas (links, etc).
    const preserved = { ...next, id: existing[existingOfType].id };
    const copy = [...existing];
    copy[existingOfType] = preserved;
    return copy;
  }
  // Não existia: navbar vai pro topo, footer pro fim, outros pro fim.
  if (next.type === "section-navbar") return [next, ...existing];
  return [...existing, next];
}
