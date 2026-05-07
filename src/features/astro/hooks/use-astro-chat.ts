"use client";

import { useChat, type UseChatOptions } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useMemo, useRef } from "react";
import { client } from "@/lib/orpc";
import { useAstro } from "@/features/astro/components/astro-provider";
import type { AgentKey } from "@/features/astro/schemas/agent-config";

interface UseAstroChatOpts {
  /** Em embeds, força um sub-agente (ex: "closer"). */
  pinnedAgentKey?: AgentKey;
  /** Mensagens iniciais (ao reabrir sessão antiga via /home recents). */
  initialMessages?: UIMessage[];
  /** Override de `body` para casos avançados. */
  bodyOverride?: () => Record<string, unknown>;
  onError?: UseChatOptions<UIMessage>["onError"];
  onFinish?: UseChatOptions<UIMessage>["onFinish"];
}

/**
 * Hook compartilhado por todas as surfaces (widget, fullscreen, embeds).
 *
 * Estratégia de sessão:
 *   1. `sendMessage` é wrappado: se ainda não há `sessionId`, cria via
 *      `orpc.astro.sessions.create` ANTES do POST do useChat.
 *   2. O `sessionId` é guardado em ref (síncrono) para já estar disponível
 *      no `body` resolvable do transport na mesma chamada.
 *   3. Updates do route context vão dinâmicos no body (snapshot a cada call).
 *
 * Reabrir sessão antiga: passar `initialMessages` + setar `sessionId` no
 * provider antes de montar.
 */
export function useAstroChat(opts: UseAstroChatOpts = {}) {
  const { sessionId, setSessionId, routeContext } = useAstro();
  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/astro/chat",
        credentials: "include",
        body: () => {
          const extra = opts.bodyOverride?.() ?? {};
          return {
            sessionId: sessionIdRef.current,
            context: routeContext,
            pinnedAgentKey: opts.pinnedAgentKey,
            ...extra,
          };
        },
      }),
    // routeContext é referência estável (memo no provider); mas inclui aqui
    // pra refletir mudança de rota dentro de SPA.
    [opts.bodyOverride, opts.pinnedAgentKey, routeContext],
  );

  const chat = useChat<UIMessage>({
    id: sessionId ?? "astro-pending",
    messages: opts.initialMessages,
    transport,
    onError: opts.onError,
    onFinish: opts.onFinish,
  });

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const created = await client.astro.sessions.create({
      context: routeContext,
    });
    sessionIdRef.current = created.id;
    setSessionId(created.id);
    return created.id;
  }, [routeContext, setSessionId]);

  /** Wrapper de `sendMessage` que garante sessão antes do POST. */
  const sendMessage = useCallback(
    async (
      ...args: Parameters<typeof chat.sendMessage>
    ): ReturnType<typeof chat.sendMessage> => {
      await ensureSession();
      return chat.sendMessage(...args);
    },
    [chat, ensureSession],
  );

  return {
    ...chat,
    /** Sobrescreve o sendMessage para criar sessão lazy. */
    sendMessage,
    sessionId,
  };
}

export type AstroChatHelpers = ReturnType<typeof useAstroChat>;
