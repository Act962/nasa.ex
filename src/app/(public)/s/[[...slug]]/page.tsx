/**
 * Rota pública das NASA Pages — agora catch-all pra suportar
 * multi-page sites:
 *
 *   /s/<root>                 → home do site (root NasaPage)
 *   /s/<root>/<subSlug>       → subpage do site
 *   /s/<root>/<inexistente>   → 404
 *
 * Compatibilidade total com URLs antigas: sites pré-migration têm
 * `parentPageId = NULL` (todos viraram top-level), então `/s/<slug>`
 * continua funcionando idêntico.
 *
 * As `siblingPages` do site (root.subpages + root) são injetadas no
 * `PublicPageView` pra que a navbar resolva links internos via
 * `subpageId`.
 */
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import { PublicPageView } from "@/features/pages/components/public/public-page-view";
import type { PageLayout } from "@/features/pages/types";

interface Params {
  slug?: string[];
}

async function resolvePage(slug?: string[]) {
  const [rootSlug, subSlug] = slug ?? [];
  if (!rootSlug) return null;

  // 1. Acha o site (top-level).
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

  // 2. Sem subSlug → renderiza a home (root).
  if (!subSlug) return { root, page: root };

  // 3. Com subSlug → procura entre as subpages publicadas.
  const sub = root.subpages.find((sibling) => sibling.slug === subSlug);
  if (!sub) return null;
  return {
    root,
    page: {
      ...sub,
      organization: root.organization,
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolvePage(slug);
  if (!resolved) return { title: "Página não encontrada" };
  const { page } = resolved;
  return {
    title: page.title,
    description: page.description ?? undefined,
    openGraph: {
      title: page.title,
      description: page.description ?? undefined,
      images: page.ogImageUrl ? [page.ogImageUrl] : undefined,
    },
    icons: page.faviconUrl ? { icon: page.faviconUrl } : undefined,
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const resolved = await resolvePage(slug);
  if (!resolved || !resolved.page.publishedLayout) notFound();

  const { root, page } = resolved;

  // Lista de páginas-irmãs (root + subpages publicadas) — pra que a
  // navbar consiga resolver links internos via `subpageId` e construir
  // hrefs `/s/<root>/<sub>` ou `/s/<root>` (a home).
  const siblingPages = [
    { id: root.id, slug: root.slug, title: root.title, isRoot: true },
    ...root.subpages.map((sub) => ({
      id: sub.id,
      slug: sub.slug,
      title: sub.title,
      isRoot: false,
    })),
  ];

  return (
    <PublicPageView
      pageId={page.id}
      slug={page.slug}
      layout={page.publishedLayout as unknown as PageLayout}
      palette={(page.palette as Record<string, string>) ?? {}}
      fontFamily={page.fontFamily}
      ownerUserId={page.userId}
      organizationSlug={page.organization?.slug ?? null}
      rootSlug={root.slug}
      siblingPages={siblingPages}
    />
  );
}
