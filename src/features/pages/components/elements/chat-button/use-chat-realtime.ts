"use client";

/**
 * Subscription Pusher do widget — substitui o antigo polling de 3s. Assina
 * o canal público `conversationId` (cuid unguessable, sem auth endpoint) e
 * escuta `message:created`, o evento que o servidor já dispara quando o
 * atendente responde via `/message/create`. Cada mensagem recebida é
 * mapeada pro formato `Msg` e entregue ao callback. Espelha o padrão de
 * `tracking-chat/hooks/use-in-chat-status-realtime.ts`.
 */

import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher";
import type { Msg } from "./types";
import { mapCreatedMessage } from "./chat-api";

export function useChatRealtime(
  conversationId: string | null,
  onAgentMessage: (message: Msg) => void,
) {
  useEffect(() => {
    if (!conversationId) return;
    const channel = pusherClient.subscribe(conversationId);
    const handler = (payload: Parameters<typeof mapCreatedMessage>[0]) => {
      onAgentMessage(mapCreatedMessage(payload));
    };
    channel.bind("message:created", handler);
    return () => {
      channel.unbind("message:created", handler);
      pusherClient.unsubscribe(conversationId);
    };
  }, [conversationId, onAgentMessage]);
}
