"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

const SEARCH_LIMIT = 20;

/**
 * Busca de leads pro campo "Lead" do `ViewActionModal`. Server-side porque a
 * org pode ter milhares de leads — carregar tudo pra filtrar no cliente não
 * escala.
 */
export function useSearchLeads(search: string, enabled = true) {
  const { data, isLoading } = useQuery({
    ...orpc.leads.search.queryOptions({
      input: { search: search || undefined, page: 1, limit: SEARCH_LIMIT },
    }),
    enabled,
  });

  return { leads: data?.leads ?? [], isLoading };
}
