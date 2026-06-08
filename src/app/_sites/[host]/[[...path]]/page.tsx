/**
 * Rota pública das NASA Pages servida por **domínio próprio**
 * (`customDomain`). Alcançada via rewrite do middleware:
 *
 *   meusite.com/             → /_sites/meusite.com            → home do site
 *   meusite.com/<subSlug>    → /_sites/meusite.com/<subSlug>  → subpage
 *   meusite.com/<inexist.>   → 404
 *
 * Catch-all `[[...path]]` pra suportar multi-page sites (igual ao
 * `/s/[[...slug]]`). A resolução (root + subpage + siblingPages) mora no
 * procedure `pages.publicResolveByDomain` (`public-resolve-by-domain.ts`),
 * que exige `domainStatus = VERIFIED`.
 *
 * `linkBasePath=""` faz a navbar montar links internos como `/` (home) e
 * `/<sub>` (subpages), em vez do `/s/<rootSlug>/...` da rota por slug.
 */
import { notFound } from "next/navigation";
import { client } from "@/lib/orpc";
import type { Metadata } from "next";
import { PublicPageView } from "@/features/pages/components/public/public-page-view";
import { resolvePageBackground } from "@/features/pages/lib/page-background";
import type { PageLayout } from "@/features/pages/types";

interface Params {
  host: string;
  path?: string[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { host, path } = await params;
  const resolved = await client.pages.publicResolveByDomain({ host, path });
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
  const { host, path } = await params;
  const resolved = await client.pages.publicResolveByDomain({ host, path });
  if (!resolved || !resolved.page.publishedLayout) notFound();

  const { page, rootSlug, siblingPages } = resolved;

  // Cor de fundo efetiva da page — mesma precedência do renderer
  // (palette.bg → artboard.background → branco) via helper compartilhado,
  // aplicada num wrapper full-screen pra cobrir o viewport inteiro.
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
        linkBasePath=""
      />
    </div>
  );
}
