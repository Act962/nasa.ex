"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useDebouncedValue } from "@/hooks/use-debounced";
import type { AstroSearchEntity } from "@/features/astro/lib/astro-picker";

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 12;

/** Busca do seletor do cartão do ASTRO (spec 0033, RF-1). Vazio = mais recentes. */
export function useAstroEntitySearch(params: { entity: AstroSearchEntity; query: string }) {
  const debouncedQuery = useDebouncedValue(params.query.trim(), SEARCH_DEBOUNCE_MS);
  const { data, isFetching } = useQuery(
    orpc.astro.searchEntities.queryOptions({
      input: { entityType: params.entity, query: debouncedQuery, limit: SEARCH_LIMIT },
    }),
  );
  return { matches: data?.matches ?? [], isSearching: isFetching };
}
