"use client";

import { useEffect } from "react";
import { realtimeSubscriber } from "./index";

type RealtimeHandlers = Record<string, (data: unknown) => void>;

/**
 * Hook genérico de subscription de realtime. Assina `channel` pela porta
 * `RealtimeSubscriber`, faz `bind` de cada handler e limpa tudo no unmount.
 * Não conhece domínio nem lib — reusável por qualquer feature.
 *
 * `handlersRef` deve ser estável entre renders (ex.: handlers que só leem
 * refs). A subscription é recriada apenas quando `channel` ou `enabled` mudam.
 */
export function useRealtimeChannel(
  channel: string | null | undefined,
  handlers: RealtimeHandlers,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled || !channel) return;

    const subscription = realtimeSubscriber.subscribe(channel);
    for (const [event, handler] of Object.entries(handlers)) {
      subscription.bind(event, handler);
    }

    return () => {
      subscription.unsubscribe();
    };
    // `handlers` é assumido estável; recriar só por channel/enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, enabled]);
}
