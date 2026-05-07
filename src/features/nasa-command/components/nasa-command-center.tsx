"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";

import { orpc, client } from "@/lib/orpc";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { useAstroChat } from "@/features/astro/hooks/use-astro-chat";
import { useAstro } from "@/features/astro/components/astro-provider";
import { AstroMessage } from "@/features/astro/components/astro-message";

import type { DropdownType, ModelType } from "../types";
import type { CommandInputProps } from "./command-input";
import { StarField } from "./star-field";
import { WelcomeScreen } from "./welcome-screen";
import { ThinkingDisplay } from "./thinking-display";
import { CommandInput } from "./command-input";

/**
 * `/home` — superfície de tela cheia do ASTRO.
 *
 * Mantém a casca visual (StarField, WelcomeScreen, CommandInput, etc.) e troca
 * o motor: ao invés de classificar intent + executar ação fixa, usamos o
 * orquestrador via `useAstroChat`. Sessões são listadas/restauradas via oRPC
 * `astro.sessions.*`.
 */
export function NasaCommandCenter() {
  const [command, setCommand] = useState("");
  const [dropdown, setDropdown] = useState<DropdownType>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  // `model` continua na UI (model-selector) mas no MVP não influencia o
  // backend — o orquestrador usa ASTRO_DEFAULT_MODEL. Override do usuário
  // fica para iteração futura.
  const [model, setModel] = useState<ModelType>("astro");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { setSessionId } = useAstro();

  // Sessões livres (sem `context`) do usuário, top 30 por updatedAt desc.
  const sessionsQuery = useQuery(
    orpc.astro.sessions.list.queryOptions({ input: { take: 30 } }),
  );

  // Para reabrir uma sessão, baixamos o histórico completo e injetamos como
  // initialMessages num useChat re-montado (chave = sessionId).
  const [hydrated, setHydrated] = useState<UIMessage[] | undefined>(undefined);

  const {
    messages,
    status,
    sendMessage,
    stop,
    error,
    setMessages,
    clearError,
    sessionId,
  } = useAstroChat({
    initialMessages: hydrated,
  });

  const deleteSessionMutation = useMutation(
    orpc.astro.sessions.delete.mutationOptions({
      onSuccess: () => sessionsQuery.refetch(),
    }),
  );

  // Auto-scroll quando mensagens mudam.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Após o stream terminar, atualiza a lista de recents.
  useEffect(() => {
    if (status === "ready" && sessionId) {
      sessionsQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionId]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      const { session } = await client.astro.sessions.get({ id });
      const msgs = (session.messages as unknown as UIMessage[]) ?? [];
      setHydrated(msgs);
      setSessionId(session.id);
      setMessages(msgs);
      clearError();
    },
    [setMessages, setSessionId, clearError],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      // Se a sessão atual foi apagada, limpa também o chat ativo.
      if (id === sessionId) {
        setMessages([]);
        setSessionId(null);
        setHydrated(undefined);
      }
      deleteSessionMutation.mutate({ id });
    },
    [sessionId, deleteSessionMutation, setMessages, setSessionId],
  );

  const submitCommand = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || status === "streaming" || status === "submitted") return;
      setCommand("");
      setDropdown(null);
      await sendMessage({ text: trimmed });
      // Stars (mantém integração existente)
      queryClient.invalidateQueries({
        queryKey: orpc.stars.getBalance.queryOptions().queryKey,
      });
    },
    [status, sendMessage, queryClient],
  );

  const handleSubmit = async () => {
    if (!command.trim()) return;
    await submitCommand(command.trim());
  };

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      void submitCommand(text.trim());
    },
    [submitCommand],
  );

  const fillExample = (example: string) => {
    setCommand(example);
  };

  const hasMessages = messages.length > 0;
  const loading = status === "streaming" || status === "submitted";

  // Steps "thinking": deriva das tool-parts ainda em execução na última msg
  // do assistente. Mantém o ThinkingDisplay alimentado por dados reais sem
  // mudar o componente visual.
  const thinkingSteps = useMemo(() => {
    if (!loading) return [];
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return ["Pensando…"];
    const inflight = last.parts
      .filter(isToolUIPart)
      .filter((p) => {
        const state = (p as { state?: string }).state;
        return state === "input-streaming" || state === "input-available";
      })
      .map((p) => `Executando ${p.type.replace(/^tool-/, "")}…`);
    return inflight.length ? inflight : ["Pensando…"];
  }, [messages, loading]);

  const commandInputProps: CommandInputProps = {
    command,
    setCommand,
    loading,
    onSubmit: handleSubmit,
    onVoiceTranscript: handleVoiceTranscript,
    model,
    setModel,
    dropdown,
    setDropdown,
    dropdownSearch,
    setDropdownSearch,
  };

  const recentSessions = (sessionsQuery.data?.sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    lastAgentKey: s.lastAgentKey,
    updatedAt: s.updatedAt,
  }));

  return (
    <div
      className="h-full flex flex-col bg-[#050510] relative overflow-hidden"
      style={{ cursor: "url('/cursors/rocket.svg') 6 4, auto" }}
    >
      <StarField />
      <HeaderTracking title="Home" />

      <div className="flex-1 overflow-y-auto relative z-10">
        {!hasMessages ? (
          <WelcomeScreen
            onSelect={fillExample}
            commandInputProps={commandInputProps}
            recentSessions={recentSessions}
            recentLoading={sessionsQuery.isLoading}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-4 space-y-2">
            {messages.map((msg) => (
              <AstroMessage key={msg.id} message={msg} />
            ))}
            {loading && <ThinkingDisplay steps={thinkingSteps} />}
            {error && (
              <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {error.message ?? "Erro ao processar."}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {hasMessages && (
        <div className="border-t border-zinc-800/60 bg-[#050510]/90 backdrop-blur px-3 sm:px-4 py-3 shrink-0 relative z-10">
          <div className="max-w-3xl mx-auto">
            <CommandInput {...commandInputProps} />
          </div>
        </div>
      )}
    </div>
  );
}
