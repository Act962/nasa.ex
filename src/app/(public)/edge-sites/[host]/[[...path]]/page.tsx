/**
 * Site de um domínio próprio. Só é alcançada por reescrita do `proxy.ts`, quando a requisição
 * vem da portaria (orbita-pages-edge) com o segredo; acesso direto responde 404 lá.
 *
 * Sem `headers()`/`cookies()` de propósito: a página fica em cache (ISR) e a maior parte das
 * visitas não consulta o banco.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicPageRenderer } from "@/features/pages/components/public/public-page-renderer";
import { PoweredByNasa } from "@/features/pages/components/public/powered-by-nasa";
import { toValidCustomDomain } from "@/features/pages/lib/edge-headers";
import { buildPageMetadata } from "@/features/pages/lib/page-seo";
import { resolvePageBackground } from "@/features/pages/lib/page-background";
import { resolveCustomDomainSite } from "@/features/pages/server/custom-domain";
import type { PageLayout } from "@/features/pages/types";
import "@/features/pages/lib/animations.css";

export const revalidate = 120;
export const dynamicParams = true;

// O build roda sem banco: nenhum site é pré-gerado, todos nascem na primeira visita.
export function generateStaticParams() {
  return [];
}

interface Params {
  host: string;
  path?: string[];
}

async function loadSite(params: Promise<Params>) {
  const { host, path } = await params;
  const customDomain = toValidCustomDomain(decodeURIComponent(host));
  if (!customDomain) return null;
  return resolveCustomDomainSite(customDomain, path ?? []);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const site = await loadSite(params);
  if (!site) return { title: "Página não encontrada" };
  return buildPageMetadata(site.page);
}

export default async function CustomDomainSitePage({ params }: { params: Promise<Params> }) {
  const site = await loadSite(params);
  if (!site) notFound();

  const { page, rootSlug, organizationSlug, siblingPages } = site;
  const layout = page.publishedLayout as unknown as PageLayout;
  const palette = (page.palette as Record<string, string>) ?? {};

  return (
    <div className="min-h-dvh w-full" style={{ background: resolvePageBackground(layout, palette) }}>
      <PublicPageRenderer
        layout={layout}
        palette={palette}
        fontFamily={page.fontFamily}
        trackingSlug={page.slug}
        organizationSlug={organizationSlug ?? undefined}
        rootSlug={rootSlug}
        siblingPages={siblingPages}
        siteBasePath=""
        appOrigin={process.env.NEXT_PUBLIC_APP_URL}
      />
      <PoweredByNasa />
    </div>
  );
}
