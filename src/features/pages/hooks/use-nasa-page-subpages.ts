"use client";

/**
 * Hooks pra subpages de um site NASA Pages.
 *
 * - `useNasaPageSubpages(parentPageId, { enabled? })`: lista as
 *   subpages do site. Devolve `[]` se o parent é uma subpage (server
 *   responde 404 → `data` undefined). Usado pela aba "Páginas" do
 *   builder e pelo dropdown "Página do site" no editor de NavLink.
 *
 * - `useCreateSubpage()`: cria nova subpage. Invalida list+cache.
 *
 * - `useReorderSubpages()`: reordena via drag-and-drop.
 *
 * - `useSetPageAsHome()`: troca qual subpage é a home (root).
 *
 * - `useBulkApplyElement()`: aplica navbar/footer em todas as páginas
 *   do site (snapshot copy).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";

function invalidateSubpages(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["pages"] });
}

export function useNasaPageSubpages(
  parentPageId: string | undefined,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    ...orpc.pages.listSubpages.queryOptions({
      input: { parentPageId: parentPageId ?? "" },
    }),
    enabled: Boolean(parentPageId) && (opts?.enabled ?? true),
    retry: false,
  });
}

export function useCreateSubpage() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.pages.createSubpage.mutationOptions(),
    onSuccess: () => invalidateSubpages(qc),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useReorderSubpages() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.pages.reorderSubpages.mutationOptions(),
    onSuccess: () => invalidateSubpages(qc),
  });
}

export function useSetPageAsHome() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.pages.setAsHome.mutationOptions(),
    onSuccess: () => invalidateSubpages(qc),
  });
}

export function useBulkApplyElement() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.pages.bulkUpdateSubpagesElement.mutationOptions(),
    onSuccess: () => invalidateSubpages(qc),
  });
}
