import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export type LeadActionCount = { total: number; done: number };
export type LeadActionCounts = Record<string, LeadActionCount>;

type CountsCache = { counts: LeadActionCounts } | undefined;

/**
 * Aplica um delta no contador de ações de um lead em TODAS as entradas de
 * `tracking.getLeadActionCounts` em cache.
 *
 * Usa `setQueriesData` (e não `setQueryData`) porque quem dispara a mutation —
 * o modal de ação — sabe o `leadId` mas não o `trackingId`, que faz parte da
 * chave. Como `counts` é indexado por leadId, patchear todas as entradas acerta
 * a certa e é no-op nas demais.
 */
export function patchLeadActionCounts(
  queryClient: QueryClient,
  leadId: string,
  delta: Partial<LeadActionCount>,
) {
  queryClient.setQueriesData(
    { queryKey: orpc.tracking.getLeadActionCounts.key() },
    (old: CountsCache) => {
      if (!old?.counts?.[leadId]) return old;

      const current = old.counts[leadId];

      return {
        ...old,
        counts: {
          ...old.counts,
          [leadId]: {
            total: Math.max(0, current.total + (delta.total ?? 0)),
            done: Math.max(0, current.done + (delta.done ?? 0)),
          },
        },
      };
    },
  );
}

/**
 * Variante escopada a um tracking. Diferente de `patchLeadActionCounts`, CRIA
 * a entrada quando ela não existe — necessário pra primeira ação de um lead,
 * que por definição ainda não está no mapa. Só é segura porque quem chama
 * conhece o `trackingId` e portanto acerta a query certa.
 */
export function bumpLeadActionCountForTracking(
  queryClient: QueryClient,
  trackingId: string,
  leadId: string,
  delta: Partial<LeadActionCount>,
) {
  queryClient.setQueryData(
    orpc.tracking.getLeadActionCounts.queryKey({ input: { trackingId } }),
    (old: CountsCache) => {
      if (!old) return old;

      const current = old.counts[leadId] ?? { total: 0, done: 0 };

      return {
        ...old,
        counts: {
          ...old.counts,
          [leadId]: {
            total: Math.max(0, current.total + (delta.total ?? 0)),
            done: Math.max(0, current.done + (delta.done ?? 0)),
          },
        },
      };
    },
  );
}

export function invalidateLeadActionCounts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: orpc.tracking.getLeadActionCounts.key(),
  });
}
