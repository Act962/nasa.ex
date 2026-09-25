"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Contagens dos segmentos do cabeçalho de /contatos (regra 9 do CLAUDE.md). */
export function useLeadSegments(filters: {
  trackingId?: string;
  tagIds?: string[];
  dateField?: "createdAt" | "lastInboundAt";
  from?: Date;
  to?: Date;
}) {
  return useQuery(
    orpc.leads.segments.queryOptions({
      input: {
        trackingId: filters.trackingId,
        tagIds: filters.tagIds?.length ? filters.tagIds : undefined,
        dateField: filters.dateField,
        from: filters.from?.toISOString(),
        to: filters.to?.toISOString(),
      },
    }),
  );
}
