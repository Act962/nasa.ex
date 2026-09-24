"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Contagens dos segmentos do cabeçalho de /contatos (regra 9 do CLAUDE.md). */
export function useLeadSegments(filters: {
  trackingId?: string;
  tagIds?: string[];
}) {
  return useQuery(
    orpc.leads.segments.queryOptions({
      input: {
        trackingId: filters.trackingId,
        tagIds: filters.tagIds?.length ? filters.tagIds : undefined,
      },
    }),
  );
}
