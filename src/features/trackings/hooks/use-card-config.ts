"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useKanbanStore } from "../lib/kanban-store";
import {
  resolveCardVisibility,
  type CardVisibility,
} from "../lib/card-visibility";

// Formato de leitura da linha `TrackingCardConfig` (o procedure não declara
// `.output()`, então tipamos o que o board consome).
export type CardConfig = {
  trackingId: string;
  fields?: unknown[];
  cardVisibility?: CardVisibility | null;
  showSlaTimer?: boolean;
  showPurchaseBasket?: boolean;
  basketRecentDays?: number;
  basketMediumDays?: number;
  basketLongDays?: number;
};

/**
 * Config de card por tracking. Todos os cards/colunas do board compartilham a
 * MESMA queryKey → React Query dedupa numa request só. Cache de 30s evita
 * refetch a cada render de coluna (mesmo padrão de `useLeadPurchasesByTracking`).
 */
export function useCardConfig(trackingId: string | null | undefined) {
  return useQuery({
    ...orpc.tracking.getCardConfig.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: !!trackingId,
    staleTime: 30_000,
    select: (data: unknown) =>
      ((data as { config?: CardConfig | null })?.config ?? null) as
        | CardConfig
        | null,
  });
}

/**
 * Visibilidade efetiva do board para um tracking: preview ao vivo do Sheet
 * (quando aberto para ESTE tracking) tem prioridade sobre o config salvo.
 * Fonte única consumida pelo card e pelo header da coluna.
 */
export function useCardVisibility(trackingId: string) {
  const { data: cardConfig } = useCardConfig(trackingId);
  const preview = useKanbanStore((store) => store.visibilityPreview);
  return resolveCardVisibility(cardConfig?.cardVisibility, preview, trackingId);
}

export function useUpdateCardConfig() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.tracking.updateCardConfig.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.getCardConfig.key(),
        });
      },
    }),
  );
}
