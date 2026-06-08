"use client";

import { createContext, useContext } from "react";

/**
 * Context injetado pelo PublicPageRenderer pra fornecer info da page
 * "ambiente" aos elements que precisam (Chat IA, etc).
 *
 * `organizationSlug` é a Single Source of Truth pro slug da org —
 * resolvido server-side a partir da relação `NasaPage.organization`,
 * em vez de confiar em `element.orgSlug` (que pode ficar stale após
 * edições antigas ou mudanças de slug).
 */
export type SiblingPageInfo = {
  id: string;
  slug: string;
  title: string;
  isRoot: boolean;
};

export type PageRenderContext = {
  /** Slug da org dona da page (server-side resolved). */
  organizationSlug?: string;
  /** Slug da própria page (pra analytics, links etc). */
  pageSlug?: string;
  /** Slug do root site (multi-page). Usado pelo navbar pra construir
   *  hrefs `/s/<rootSlug>` e `/s/<rootSlug>/<sub>`. */
  rootSlug?: string;
  /** Páginas-irmãs publicadas do site (root + subpages). Alimentada
   *  pelo dropdown "link interno" e pela resolução de NavLink.subpageId. */
  siblingPages?: SiblingPageInfo[];
  /** Nomes dos planos detectados em sections-pricing da page atual.
   *  Usado pelo elemento Marketing pra gerar toasts "Fulano adquiriu
   *  <plano>". Vazio se a page não tem pricing. */
  availablePlans?: string[];
  /** Tracking destino dos leads criados pelo ChatButton desta page —
   *  configurado nas Configurações da Página (layout.meta). Tem
   *  prioridade sobre `element.trackingId` do botão. */
  inChatTrackingId?: string;
  /** Status destino dos leads (dentro do `inChatTrackingId`). Só vale
   *  junto com o tracking da página. */
  inChatStatusId?: string;
};

const ctx = createContext<PageRenderContext>({});

export const PageRenderContextProvider = ctx.Provider;

export function usePageRenderContext() {
  return useContext(ctx);
}
