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
 * A resolução no banco (root + subpage + siblingPages) mora no procedure
 * oRPC `pages.publicResolve` (`src/app/router/pages/public-resolve.ts`).
 * As `siblingPages` são injetadas no `PublicPageView` pra que a navbar
 * resolva links internos via `subpageId`.
 */
import { notFound } from "next/navigation";
import { client } from "@/lib/orpc";
import type { Metadata } from "next";
import { PublicPageView } from "@/features/pages/components/public/public-page-view";
import { resolvePageBackground } from "@/features/pages/lib/page-background";
import type { PageLayout } from "@/features/pages/types";

interface Params {
  slug?: string[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await client.pages.publicResolve({ slug });
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
  const resolved = await client.pages.publicResolve({ slug });
  if (!resolved || !resolved.page.publishedLayout) notFound();

  const { page, rootSlug, siblingPages } = resolved;

  // Cor de fundo efetiva da page — resolvida com a MESMA precedência do
  // renderer (palette.bg → artboard.background → branco) via helper
  // compartilhado. Aplicada num wrapper full-screen pra que a cor cubra
  // o viewport inteiro, não só o artboard centralizado (no modo canvas,
  // as laterais/fundo apareceriam brancas sem isso).
  const layout = page.publishedLayout as unknown as PageLayout;
  const palette = (page.palette as Record<string, string>) ?? {};
  const pageBackground = resolvePageBackground(layout, palette);

  return (
    <div className="min-h-dvh w-full" style={{ background: pageBackground }}>
      <PublicPageView
        pageId={page.id}
        slug={page.slug}
        layout={layout}
        palette={palette}
        fontFamily={page.fontFamily}
        ownerUserId={page.userId}
        organizationSlug={page.organizationSlug}
        rootSlug={rootSlug}
        siblingPages={siblingPages}
      />
    </div>
  );
}
