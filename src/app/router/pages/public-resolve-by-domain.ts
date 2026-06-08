import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Resolve a página pública das NASA Pages a partir de um **domínio
 * próprio** (`customDomain`), servida pela rota catch-all
 * `_sites/[host]/[[...path]]`:
 *
 *   meusite.com/             → home do site (root, parentPageId = NULL)
 *   meusite.com/<subSlug>    → subpage publicada do site
 *   meusite.com/<inexist.>   → null (a rota traduz em 404)
 *
 * É o espelho de `resolvePublicPage` (`public-resolve.ts`), mas keyed por
 * `customDomain` + `domainStatus = VERIFIED` em vez de `slug`. Exige o
 * domínio verificado pra evitar servir page em domínio não-confirmado.
 *
 * Retorna `null` (em vez de NOT_FOUND) quando nada resolve — o server
 * component cai num título de fallback e chama `notFound()`. Também monta
 * `siblingPages` (root + subpages publicadas) pra navbar resolver links
 * internos via `subpageId`. No domínio próprio o `linkBasePath` é `""`
 * (resolvido no componente), então a home vira `/` e as subpages `/<sub>`.
 */
export const resolvePublicPageByDomain = base
  .route({
    method: "GET",
    path: "/public/pages/resolve-by-domain",
    summary: "Resolver página pública (root + subpage) por domínio próprio",
  })
  .input(
    z.object({
      host: z.string(),
      path: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const host = input.host.toLowerCase();
    const [subSlug] = input.path ?? [];

    // 1. Acha o site (root publicado) pelo domínio VERIFICADO.
    const root = await prisma.nasaPage.findFirst({
      where: {
        customDomain: host,
        parentPageId: null,
        status: "PUBLISHED",
        domainStatus: "VERIFIED",
      },
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

    // Lista de páginas-irmãs (root + subpages) — pra navbar construir
    // hrefs `/<sub>` (ou `/` na home) via `subpageId` + `linkBasePath=""`.
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
