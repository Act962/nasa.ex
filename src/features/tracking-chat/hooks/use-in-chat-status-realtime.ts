"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pusherClient } from "@/lib/pusher";
import { orpc } from "@/lib/orpc";

/**
 * Mantém o cache do `getInChatStatus` atualizado via Pusher (push-based),
 * eliminando a necessidade de polling.
 *
 * O server emite `inchat:status-changed` no channel `<trackingId>` quando:
 *  - Toggle manual liga/desliga (procedure `toggleInChatManual`)
 *  - Cron detecta ban automático (`markInstanceConnectionFailure` ativa)
 *  - Cron detecta recovery (`markInstanceConnectionHealthy` desativa)
 *
 * O cliente assina o channel UMA vez por trackingId (channel já é
 * compartilhado com `conversation:new`/`message:new` — zero conexão
 * extra) e invalida a query, fazendo refetch com dados frescos.
 *
 * Escala: ao invés de cada atendente fazer 1 query/30s pollando (100k
 * queries/min em platform-wide), agora só refetch quando algo realmente
 * muda. Custo: 3 `pusherServer.trigger()` calls a mais no server, raros.
 */
export function useInChatStatusRealtime(trackingId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!trackingId) return;
    const channel = pusherClient.subscribe(trackingId);
    const handler = () => {
      qc.invalidateQueries({
        queryKey: orpc.conversation.getInChatStatus.queryOptions({
          input: { trackingId },
        }).queryKey,
      });
    };
    channel.bind("inchat:status-changed", handler);

    return () => {
      channel.unbind("inchat:status-changed", handler);
      // Não fazemos `pusherClient.unsubscribe(trackingId)` aqui — outros
      // componentes (conversation-list, etc.) também escutam o mesmo
      // channel. Pusher faz refcount internamente no .subscribe(),
      // descartar a subscription só quando o último consumer sair.
    };
  }, [trackingId, qc]);
}
