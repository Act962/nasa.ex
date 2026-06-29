"use client";

/**
 * useStationChat — Chat geral da Station no World.
 *
 * - Carrega histórico via `orpc.spaceStation.listStationMessages` (paginado).
 * - Assina o channel Pusher `presence-world-${stationId}` no evento
 *   `station:message` (mesmo channel da presença — evita conexão extra).
 * - Expõe `sendMessage(body)` + `unreadCount` (incrementa enquanto drawer
 *   fechado) + `markAllRead()` (resetar contador ao abrir o drawer).
 *
 * Isolado totalmente de:
 *   - `useTrackingChat` / `LeadMessage` (chat 1:1 do Cutucar via WhatsApp)
 *   - `useMessageStore` / Zustand do tracking-chat
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

export interface StationChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  body: string;
  createdAt: string | Date;
}

interface Options {
  stationId: string;
  /** Se true, novos messages NÃO incrementam unreadCount (drawer aberto). */
  isOpen: boolean;
}

export function useStationChat({ stationId, isOpen }: Options) {
  const { data: session } = authClient.useSession();
  const myUserId = session?.user?.id;
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);

  // Ref pra ler o último isOpen no callback do Pusher sem re-criar a subscription.
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // 1) Histórico inicial via oRPC. Atualiza optimistic via setQueryData no
  //    callback do Pusher (sem refetch — evita race com nova mensagem própria).
  const queryKey = ["spaceStation", "listStationMessages", stationId] as const;
  const historyQuery = useQuery({
    ...orpc.spaceStation.listStationMessages.queryOptions({
      input: { stationId },
    }),
    queryKey,
    enabled: !!stationId,
  });

  // 2) Subscribe Pusher ao mesmo channel da presença do World.
  useEffect(() => {
    if (!stationId || !myUserId) return;

    let ch: import("pusher-js").Channel | null = null;
    let pusherInstance: import("pusher-js").default | null = null;

    async function setup() {
      const PusherClient = (await import("pusher-js")).default;
      pusherInstance = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
        {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: `/api/pusher/auth?uid=${encodeURIComponent(myUserId ?? "")}`,
        },
      );
      ch = pusherInstance.subscribe(`presence-world-${stationId}`);

      ch.bind("station:message", (raw: StationChatMessage) => {
        // Append no cache do React Query pra mostrar instantâneo.
        queryClient.setQueryData<{
          messages: StationChatMessage[];
          nextCursor: string | null;
          hasMore: boolean;
        }>(queryKey, (old) => {
          if (!old) return { messages: [raw], nextCursor: null, hasMore: false };
          // Evita duplicar minha própria mensagem (vem do POST com sucesso já
          // adicionado optimistic OU vem do Pusher).
          if (old.messages.some((m) => m.id === raw.id)) return old;
          return { ...old, messages: [raw, ...old.messages] };
        });

        // Incrementa unread só se for de OUTRO user E drawer fechado.
        if (raw.senderId !== myUserId && !isOpenRef.current) {
          setUnreadCount((n) => n + 1);
        }
      });
    }

    setup();

    return () => {
      try {
        ch?.unbind("station:message");
        if (pusherInstance && stationId) {
          pusherInstance.unsubscribe(`presence-world-${stationId}`);
        }
        pusherInstance?.disconnect();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, myUserId]);

  // 3) Send mutation.
  const sendMutation = useMutation({
    ...orpc.spaceStation.sendStationMessage.mutationOptions(),
    onSuccess: (msg) => {
      // Append na lista (caso o Pusher demore — UX instantâneo).
      queryClient.setQueryData<{
        messages: StationChatMessage[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(queryKey, (old) => {
        if (!old) return { messages: [msg as StationChatMessage], nextCursor: null, hasMore: false };
        if (old.messages.some((m) => m.id === msg.id)) return old;
        return { ...old, messages: [msg as StationChatMessage, ...old.messages] };
      });
    },
  });

  function sendMessage(body: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    sendMutation.mutate({ stationId, body: trimmed });
  }

  function markAllRead() {
    setUnreadCount(0);
  }

  // Reset auto quando drawer abre.
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  return {
    messages: historyQuery.data?.messages ?? [],
    isLoading: historyQuery.isLoading,
    error: historyQuery.error,
    sendMessage,
    isSending: sendMutation.isPending,
    unreadCount,
    markAllRead,
  };
}
