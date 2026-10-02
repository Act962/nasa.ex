"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import { applyTemplate, type PageTemplate } from "../lib/page-templates";
import type { ElementBase } from "../types";

const TEMPLATE_ARTBOARD_WIDTH_PX = 1200;
const MIN_ARTBOARD_HEIGHT_PX = 800;

function randomSlugSuffix(length: number) {
  return Math.random().toString(36).slice(2, 2 + length);
}

function computeLayoutHeight(elements: { y?: number; h?: number }[]) {
  const contentHeight = elements.reduce(
    (maxBottom, element) => Math.max(maxBottom, (element.y ?? 0) + (element.h ?? 0)),
    0,
  );
  return Math.max(MIN_ARTBOARD_HEIGHT_PX, contentHeight);
}

export function useListPageTemplates() {
  return useQuery({
    ...orpc.pages.listTemplates.queryOptions({ input: {} }),
    staleTime: 30_000,
  });
}

/** Template da comunidade = cópia de uma página existente. */
export function useDuplicateTemplatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: { id: string; title: string; slug: string }) =>
      client.pages.duplicatePage({
        id: template.id,
        newSlug: `${template.slug}-${randomSlugSuffix(5)}`,
        newTitle: `${template.title} (cópia)`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.pages.key() }),
  });
}

/** Template da plataforma (código): cria a página vazia e injeta os blocos do template. */
export function useCreatePageFromCodeTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: PageTemplate) => {
      const appliedTemplate = applyTemplate(template.id);
      if (!appliedTemplate) throw new Error("Template inválido");

      const created = await client.pages.createPage({
        title: template.name,
        slug: `${template.id}-${randomSlugSuffix(5)}`,
        description: template.description,
        intent: template.intent,
        layerCount: 1,
        palette: {
          primary: template.tokens.primary,
          accent: template.tokens.accent,
          bg: template.tokens.bg,
          fg: template.tokens.fg,
          muted: template.tokens.muted,
        },
      });

      await client.pages.updatePage({
        id: created.page.id,
        layout: {
          mode: "single",
          main: { elements: appliedTemplate.elements as ElementBase[] },
          artboard: { width: TEMPLATE_ARTBOARD_WIDTH_PX, minHeight: computeLayoutHeight(appliedTemplate.elements) },
          tokens: { colors: appliedTemplate.tokens },
        },
      });

      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.pages.key() }),
  });
}

/** Lê um site público, monta os blocos e cria a página nova (clone → create → update). */
export function useClonePageFromUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourceUrl: string) => {
      const scraped = await client.pages.cloneFromUrl({ url: sourceUrl });

      const created = await client.pages.createPage({
        title: scraped.title.slice(0, 80),
        slug: `import-${randomSlugSuffix(6)}`,
        description: scraped.description || undefined,
        intent: "LANDING",
        layerCount: 1,
        palette: scraped.tokens.colors,
      });

      await client.pages.updatePage({
        id: created.page.id,
        layout: {
          mode: "single",
          main: { elements: scraped.elements as ElementBase[] },
          artboard: {
            width: TEMPLATE_ARTBOARD_WIDTH_PX,
            minHeight: computeLayoutHeight(scraped.elements as { y?: number; h?: number }[]),
          },
          tokens: scraped.tokens,
        },
      });

      return { page: created.page, stats: scraped.stats };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.pages.key() }),
  });
}
