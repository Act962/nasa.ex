"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Indicadores do "Auditar Lead" somados no painel de /contatos (spec 0035). */
export function useLeadMetricsSummary(filters: {
  trackingId?: string;
  tagIds?: string[];
  dateField?: "createdAt" | "lastInboundAt";
  from?: Date;
  to?: Date;
}) {
  return useQuery(
    orpc.leads.metricsSummary.queryOptions({
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
