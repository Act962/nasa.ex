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
export type PageRenderContext = {
  /** Slug da org dona da page (server-side resolved). */
  organizationSlug?: string;
  /** Slug da própria page (pra analytics, links etc). */
  pageSlug?: string;
};

const ctx = createContext<PageRenderContext>({});

export const PageRenderContextProvider = ctx.Provider;

export function usePageRenderContext() {
  return useContext(ctx);
}
