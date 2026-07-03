"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Batch fetch de "última compra por lead" a partir do trackingId.
 *
 * Como todos os LeadItem do board usam a MESMA queryKey `[lead-purchases,
 * trackingId]`, o React Query dedupa e faz uma request só, mesmo com 100+
 * cards. Cache de 30s pra evitar refetch a cada render de coluna.
 */
export function useLeadPurchasesByTracking(trackingId: string | null) {
  return useQuery({
    ...orpc.tracking.getLeadPurchases.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: !!trackingId,
    staleTime: 30_000,
  });
}
