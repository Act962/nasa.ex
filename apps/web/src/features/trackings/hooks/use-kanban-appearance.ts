"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Lê os campos de aparência do KANBAN (cores de card, coluna, fundo +
 * imagem) configurados na tab "Personalização" das Configurações do
 * tracking.
 *
 * `staleTime` de 5min: aparência muda raramente. Compartilhado entre
 * vários componentes do kanban (board-container, status-column,
 * lead-item) — TanStack Query dedupa automaticamente.
 */
export function useKanbanAppearance(trackingId: string) {
  return useQuery(
    orpc.tracking.getKanbanAppearance.queryOptions({
      input: { trackingId },
      staleTime: 5 * 60 * 1000,
      enabled: !!trackingId,
    }),
  );
}
