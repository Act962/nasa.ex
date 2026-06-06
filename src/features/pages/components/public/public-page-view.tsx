"use client";

import { useEffect } from "react";
import { client } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { PublicPageRenderer } from "./public-page-renderer";
import { InlineEditProvider } from "../inline-edit/inline-edit-provider";
import { PoweredByNasa } from "./powered-by-nasa";
// CSS de animações NASA Pages (Fase 4 do builder evoluído).
// Importado aqui no client component public-page-view pra que toda
// página publicada já tenha as keyframes disponíveis.
import "../../lib/animations.css";
import type { PageLayout } from "../../types";

/**
 * Página irmã do site atual — usado pela navbar pra resolver links
 * internos via `subpageId` em vez de URL hardcoded. `isRoot` distingue
 * a home (URL = `/s/<rootSlug>`) das subpages (`/s/<rootSlug>/<slug>`).
 */
export interface SiblingPage {
  id: string;
  slug: string;
  title: string;
  isRoot: boolean;
}

interface Props {
  pageId: string;
  slug: string;
  layout: PageLayout;
  palette?: Record<string, string>;
  fontFamily?: string | null;
  ownerUserId: string;
  /** Slug da organização dona da page (resolvido server-side).
   *  Source of truth pro ChatButton — element.orgSlug salvo no JSON
   *  pode estar stale (mudança de slug, edição manual antiga). */
  organizationSlug?: string | null;
  /** Slug do root site (igual ao do home). Usado pra montar URLs de
   *  links internos da navbar `/s/<rootSlug>/<sub>`. */
  rootSlug?: string;
  /** Páginas-irmãs publicadas do site atual (root + subpages). */
  siblingPages?: SiblingPage[];
}

export function PublicPageView({
  pageId,
  slug,
  layout,
  palette,
  fontFamily,
  ownerUserId,
  organizationSlug,
  rootSlug,
  siblingPages,
}: Props) {
  const { data: session } = authClient.useSession();
  const isOwner = session?.user?.id === ownerUserId;

  // Page-view + tracking de scroll/click/section/dwell agora
  // gerenciado pelo PageTracker — incluído via PublicPageRenderer
  // recebendo `slug`. Mantemos esse useEffect comentado pra docs.

  if (isOwner) {
    return (
      <>
        <InlineEditProvider
          pageId={pageId}
          initialLayout={layout}
          palette={palette}
          fontFamily={fontFamily}
          organizationSlug={organizationSlug ?? undefined}
          rootSlug={rootSlug}
          siblingPages={siblingPages}
        />
        <PoweredByNasa />
      </>
    );
  }

  return (
    <>
      <PublicPageRenderer
        layout={layout}
        palette={palette}
        fontFamily={fontFamily}
        trackingSlug={slug}
        organizationSlug={organizationSlug ?? undefined}
        rootSlug={rootSlug}
        siblingPages={siblingPages}
      />
      <PoweredByNasa />
    </>
  );
}
