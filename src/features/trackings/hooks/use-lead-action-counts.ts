"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc } from "@/lib/orpc";
import {
  type LeadActionCount,
  bumpLeadActionCountForTracking,
} from "../lib/lead-action-counts-cache";

/**
 * Batch de "ações concluídas/total por lead" a partir do trackingId.
 *
 * Todos os LeadItem do board usam a MESMA queryKey, então o React Query dedupa
 * numa request só mesmo com 100+ cards — mesmo desenho de
 * `useLeadPurchasesByTracking`.
 */
export function useLeadActionCountsByTracking(trackingId: string | null) {
  return useQuery({
    ...orpc.tracking.getLeadActionCounts.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: !!trackingId,
    staleTime: 30_000,
  });
}

/**
 * Patch otimista do contador, pra quando a ação é criada de dentro do sheet —
 * o badge do card atrás precisa mexer na hora, sem esperar o refetch.
 */
export function useLeadActionCountsPatch(trackingId: string | null) {
  const queryClient = useQueryClient();

  const applyDelta = useCallback(
    (leadId: string, delta: Partial<LeadActionCount>) => {
      if (!trackingId) return;
      bumpLeadActionCountForTracking(queryClient, trackingId, leadId, delta);
    },
    [queryClient, trackingId],
  );

  return { applyDelta };
}
