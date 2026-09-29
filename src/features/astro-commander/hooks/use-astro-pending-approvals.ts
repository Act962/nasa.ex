"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Aprovações pendentes do ASTRO para o widget e para o orb (spec 0028, RF-8).
 *
 * O sino já avisa; aqui o objetivo é outro: quem está conversando com o ASTRO
 * decide na mesma tela, sem ir até o app.
 */

/** Intervalo curto: a aprovação é o gargalo entre o comando e o efeito. */
const REFETCH_MS = 60_000;

export function useAstroPendingApprovals(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...orpc.astroCommander.approvals.list.queryOptions({ input: { limit: 20 } }),
    enabled,
    refetchInterval: enabled ? REFETCH_MS : false,
    refetchOnWindowFocus: true,
  });

  // O bell publica `alert:new` no Pusher quando a execução cria pendência;
  // aproveitamos o mesmo sinal em vez de encurtar o intervalo.
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: orpc.astroCommander.approvals.list.queryKey(),
      });
    };
    window.addEventListener(ASTRO_APPROVALS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ASTRO_APPROVALS_CHANGED_EVENT, refresh);
  }, [enabled, queryClient]);

  const approvals = query.data?.approvals ?? [];
  return {
    approvals,
    pendingCount: approvals.length,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/** Evento de janela que força o recarregamento da fila. */
export const ASTRO_APPROVALS_CHANGED_EVENT = "astro:approvals-changed";

export function notifyAstroApprovalsChanged() {
  window.dispatchEvent(new Event(ASTRO_APPROVALS_CHANGED_EVENT));
}
