"use client";

import { useEffect } from "react";
import { client } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { PublicPageRenderer } from "./public-page-renderer";
import { InlineEditProvider } from "../inline-edit/inline-edit-provider";
// CSS de animações NASA Pages (Fase 4 do builder evoluído).
// Importado aqui no client component public-page-view pra que toda
// página publicada já tenha as keyframes disponíveis.
import "../../lib/animations.css";
import type { PageLayout } from "../../types";

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
}

export function PublicPageView({
  pageId,
  slug,
  layout,
  palette,
  fontFamily,
  ownerUserId,
  organizationSlug,
}: Props) {
  const { data: session } = authClient.useSession();
  const isOwner = session?.user?.id === ownerUserId;

  // Page-view + tracking de scroll/click/section/dwell agora
  // gerenciado pelo PageTracker — incluído via PublicPageRenderer
  // recebendo `slug`. Mantemos esse useEffect comentado pra docs.

  if (isOwner) {
    return (
      <InlineEditProvider
        pageId={pageId}
        initialLayout={layout}
        palette={palette}
        fontFamily={fontFamily}
        organizationSlug={organizationSlug ?? undefined}
      />
    );
  }

  return (
    <PublicPageRenderer
      layout={layout}
      palette={palette}
      fontFamily={fontFamily}
      trackingSlug={slug}
      organizationSlug={organizationSlug ?? undefined}
    />
  );
}
