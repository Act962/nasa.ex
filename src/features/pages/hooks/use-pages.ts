"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function usePages() {
  return useQuery({
    ...orpc.pages.listPages.queryOptions({ input: {} }),
    staleTime: 10_000,
  });
}

export function usePagesCost() {
  return useQuery({
    ...orpc.pages.getCost.queryOptions({ input: {} }),
    staleTime: 30_000,
  });
}

export function usePage(id: string) {
  return useQuery({
    ...orpc.pages.getPage.queryOptions({ input: { id } }),
    enabled: !!id,
  });
}

export function usePageResources() {
  return useQuery({
    ...orpc.pages.getResources.queryOptions({ input: {} }),
    staleTime: 30_000,
  });
}

/**
 * Exclui uma página (root OU subpage). Invalida listas dependentes.
 * Roots com subpages caem em cascade pela FK do schema.
 */
export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.pages.deletePage.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages"] }),
  });
}

/**
 * Atualiza o slug de uma página (parte da URL pública). Valida unicidade
 * server-side respeitando hierarquia (top-level único global, subpage
 * único por parent).
 */
export function useUpdatePageSlug() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.pages.updatePageSlug.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages"] }),
  });
}
