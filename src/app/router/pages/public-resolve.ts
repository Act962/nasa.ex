import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Resolve a página pública das NASA Pages a partir do catch-all `/s/[[...slug]]`.
 *
 *   /s/<root>             → home do site (root NasaPage, parentPageId = NULL)
 *   /s/<root>/<subSlug>   → subpage publicada do site
 *   /s/<root>/<inexist.>  → null (a rota traduz em 404)
 *
 * Retorna `null` (em vez de lançar NOT_FOUND) quando nada resolve, porque
 * "não encontrado" é caminho normal aqui: `generateMetadata` cai num título
 * de fallback e o `Page` chama `notFound()`. Também já monta `siblingPages`
 * (root + subpages publicadas) pra navbar resolver links internos via
 * `subpageId`, deixando o server component fino.
 */
export const resolvePublicPage = base
  .route({
    method: "GET",
    path: "/public/pages/resolve",
    summary: "Resolver página pública (root + subpage) por slug catch-all",
  })
  .input(z.object({ slug: z.array(z.string()).optional() }))
  .handler(async ({ input }) => {
    const [rootSlug, subSlug] = input.slug ?? [];
    if (!rootSlug) return null;

    // 1. Acha o site (top-level publicado).
    const root = await prisma.nasaPage.findFirst({
      where: { slug: rootSlug, parentPageId: null, status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        publishedLayout: true,
        palette: true,
        fontFamily: true,
        userId: true,
        faviconUrl: true,
        ogImageUrl: true,
        organization: { select: { slug: true } },
        subpages: {
          where: { status: "PUBLISHED" },
          orderBy: [{ subpageOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            publishedLayout: true,
            palette: true,
            fontFamily: true,
            userId: true,
            faviconUrl: true,
            ogImageUrl: true,
          },
        },
      },
    });
    if (!root) return null;

    // 2. Sem subSlug → home (root). Com subSlug → procura entre as subpages.
    const target = subSlug
      ? root.subpages.find((sibling) => sibling.slug === subSlug)
      : root;
    if (!target) return null;

    // Lista de páginas-irmãs (root + subpages publicadas) — pra que a navbar
    // construa hrefs `/s/<root>/<sub>` ou `/s/<root>` (a home) via `subpageId`.
    const siblingPages = [
      { id: root.id, slug: root.slug, title: root.title, isRoot: true },
      ...root.subpages.map((sub) => ({
        id: sub.id,
        slug: sub.slug,
        title: sub.title,
        isRoot: false,
      })),
    ];

    return {
      page: {
        id: target.id,
        slug: target.slug,
        title: target.title,
        description: target.description,
        publishedLayout: target.publishedLayout,
        palette: target.palette,
        fontFamily: target.fontFamily,
        userId: target.userId,
        faviconUrl: target.faviconUrl,
        ogImageUrl: target.ogImageUrl,
        organizationSlug: root.organization?.slug ?? null,
      },
      rootSlug: root.slug,
      siblingPages,
    };
  });
