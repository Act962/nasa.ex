/**
 * SEO da página publicada. Os campos editados na aba Ajustes ficam em `layout.meta` e viajam
 * com a publicação; o que estiver vazio cai nos dados do cadastro do site (nome, descrição).
 */
import type { Metadata } from "next";

export const SEO_TITLE_RECOMMENDED_LENGTH = 60;
export const SEO_DESCRIPTION_RECOMMENDED_LENGTH = 160;

export interface PageSeoFields {
  title?: string;
  description?: string;
  /** Imagem mostrada quando o link é compartilhado (WhatsApp, Instagram, LinkedIn). */
  og?: string;
  favicon?: string;
  /** Pede aos buscadores para não listarem a página. */
  noIndex?: boolean;
}

interface PageSeoSource {
  title: string;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  publishedLayout: unknown;
}

function toFilledText(rawValue: unknown): string | undefined {
  return typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : undefined;
}

export function readPageSeoFields(layout: unknown): PageSeoFields {
  const meta = (layout as { meta?: Record<string, unknown> } | null | undefined)?.meta ?? {};
  return {
    title: toFilledText(meta.title),
    description: toFilledText(meta.description),
    og: toFilledText(meta.og),
    favicon: toFilledText(meta.favicon),
    noIndex: meta.noIndex === true,
  };
}

export function buildPageMetadata(page: PageSeoSource): Metadata {
  const seo = readPageSeoFields(page.publishedLayout);
  const title = seo.title ?? page.title;
  const description = seo.description ?? page.description ?? undefined;
  const shareImageUrl = seo.og ?? page.ogImageUrl ?? undefined;
  const faviconUrl = seo.favicon ?? page.faviconUrl ?? undefined;

  return {
    // `absolute` impede que um template de título do app seja aplicado por cima.
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      title,
      description,
      images: shareImageUrl ? [shareImageUrl] : undefined,
    },
    twitter: {
      card: shareImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: shareImageUrl ? [shareImageUrl] : undefined,
    },
    // As chaves só entram quando há valor: `icons: undefined` apagaria o ícone herdado do app
    // e a página ficaria sem favicon nenhum.
    ...(faviconUrl ? { icons: { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl } } : {}),
    ...(seo.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
