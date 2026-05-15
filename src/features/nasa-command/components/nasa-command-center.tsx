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
import { useAutoNarrate } from "@/features/astro/voice/use-auto-narrate";
import { useVoiceModeStore } from "@/features/astro/voice/use-voice-mode-store";
import { useAstroOrbStore } from "@/features/astro/voice/use-astro-orb-store";
import { SlashComposer } from "@/features/astro/composer/slash-composer";
import { MessageSquare, SquareSlash } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

import type { DropdownType, ModelType } from "../types";
import type { CommandInputHandle, CommandInputProps } from "./command-input";
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

/**
 * Labels amigáveis quando o orchestrator delega pra um sub-agente.
 * Chave: agentKey snake_case (matches `route_to_${key.replace(/-/g, "_")}`).
 * Fallback: "Explorando no universo NASA" pra qualquer agente novo.
 */
const ROUTE_AGENT_LABELS: Record<string, string> = {
  closer: "Pensando na melhor resposta…",
  task_agent: "Organizando suas tarefas no espaço…",
  automation_agent: "Configurando automação na nave…",
  analytics_agent: "Explorando no universo NASA…",
};

export function NasaCommandCenter() {
  const [command, setCommand] = useState("");
  const [dropdown, setDropdown] = useState<DropdownType>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  // Modo de input: "chat" (texto livre + voz) ou "composer" (chips coloridos).
  const [inputMode, setInputMode] = useState<"chat" | "composer">("chat");
  // `model` continua na UI (model-selector) mas no MVP não influencia o
  // backend — o orquestrador usa ASTRO_DEFAULT_MODEL. Override do usuário
  // fica para iteração futura.
  const [model, setModel] = useState<ModelType>("astro");
  const bottomRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<CommandInputHandle>(null);
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

  const setLastInputWasVoice = useVoiceModeStore(
    (s) => s.setLastInputWasVoice,
  );

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      // Marca a entrada como voz — usado pelo modo "match-input" do TTS
      // pra decidir se Astro responde em áudio.
      setLastInputWasVoice(true);
      void submitCommand(text.trim());
    },
    [submitCommand, setLastInputWasVoice],
  );

  // Auto-narração: quando o stream termina, narra a resposta do Astro
  // se o modo de output permitir (match + last input por voz, ou "audio").
  useAutoNarrate({ messages, status });

  // ── Auto-continue do mic: conversa contínua ─────────────────────────
  // Quando user faz pedido por voz, Astro responde e narra. Assim que o
  // TTS termina (isSpeaking volta a false) E a última entrada foi voz,
  // o mic reabre automaticamente — user não precisa apertar o botão a
  // cada turno. Sai do loop quando user digitar ou cancelar manualmente.
  const isSpeaking = useVoiceModeStore((s) => s.isSpeaking);
  const lastInputWasVoiceFlag = useVoiceModeStore(
    (s) => s.lastInputWasVoice,
  );
  const prevSpeakingRef = useRef(false);
  useEffect(() => {
    const wasSpeaking = prevSpeakingRef.current;
    prevSpeakingRef.current = isSpeaking;
    // Trigger só na borda "speaking → not speaking" (TTS acabou agora)
    if (wasSpeaking && !isSpeaking && lastInputWasVoiceFlag) {
      // Pequeno delay pra Web Speech assentar antes de reabrir o mic
      const t = setTimeout(() => {
        commandInputRef.current?.startListening();
      }, 250);
      return () => clearTimeout(t);
    }
  }, [isSpeaking, lastInputWasVoiceFlag]);

  // ── Wake word integration ──────────────────────────────────────────
  // O AstroOrb (montado globalmente em platform-providers) captura
  // utterance após detectar "ASTRO" e grava em:
  //   - useAstroOrbStore.pendingUtterance (quando já estamos no /home)
  //   - URL ?prompt= (quando veio de outra página)
  // Aqui consumimos ambos, auto-submetemos e limpamos.
  const pendingUtterance = useAstroOrbStore((s) => s.pendingUtterance);
  const setPendingUtterance = useAstroOrbStore((s) => s.setPendingUtterance);
  const setOrbPhase = useAstroOrbStore((s) => s.setPhase);
  const searchParams = useSearchParams();
  const routerNav = useRouter();
  const consumedRef = useRef(false);

  // Quando stream termina, devolve o orb pra idle (a menos que TTS esteja falando — phase=speaking é gerenciado pelo orb a partir do useVoiceModeStore.isSpeaking).
  useEffect(() => {
    if (status === "ready") {
      const phase = useAstroOrbStore.getState().phase;
      if (phase === "thinking") setOrbPhase("idle");
    }
  }, [status, setOrbPhase]);

  useEffect(() => {
    if (consumedRef.current) return;
    const fromUrl = searchParams.get("prompt");
    const fromStore = pendingUtterance;
    const text = (fromStore || fromUrl || "").trim();
    if (!text) return;
    consumedRef.current = true;

    // Tudo que veio do orb é por voz — força modo voice
    setLastInputWasVoice(true);
    // Limpa fontes pra evitar resubmit
    if (fromStore) setPendingUtterance(null);
    if (fromUrl) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("prompt");
      routerNav.replace(`/home${sp.toString() ? `?${sp.toString()}` : ""}`);
    }
    // O orb está em "thinking" enquanto Astro processa
    setOrbPhase("thinking");
    void submitCommand(text);
    // Idempotência: reset após pequena janela
    setTimeout(() => {
      consumedRef.current = false;
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUtterance, searchParams]);

  const fillExample = (example: string) => {
    setCommand(example);
  };

  const hasMessages = messages.length > 0;
  const loading = status === "streaming" || status === "submitted";

  // Steps "thinking": deriva das tool-parts ainda em execução na última msg
  // do assistente. Tools `route_to_*` (delegação pro sub-agente) ganham
  // label amigável + foguete animado em vez do nome cru.
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
      .map((p) => {
        const toolName = p.type.replace(/^tool-/, "");
        // Detecta delegação pra sub-agente (route_to_X) e mostra com tema
        // de exploração NASA + foguete animado.
        const routeMatch = /^route_to_(.+)$/.exec(toolName);
        if (routeMatch) {
          const agentKey = routeMatch[1]!;
          return {
            label: ROUTE_AGENT_LABELS[agentKey] ?? "Explorando no universo NASA",
            mode: "rocket" as const,
          };
        }
        return `Executando ${toolName}…`;
      });
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
            {(() => {
              // Somatória cumulativa de tokens por mensagem assistant.
              // Cada AstroMessage recebe o total da sessão até ele (não só
              // os tokens da requisição que gerou aquela resposta).
              let runningTotal = 0;
              return messages.map((msg) => {
                const msgTokens =
                  (msg as { metadata?: { tokens?: number } }).metadata
                    ?.tokens ?? 0;
                if (msg.role === "assistant" && msgTokens > 0) {
                  runningTotal += msgTokens;
                }
                return (
                  <AstroMessage
                    key={msg.id}
                    message={msg}
                    cumulativeTokens={
                      msg.role === "assistant" ? runningTotal : undefined
                    }
                  />
                );
              });
            })()}
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
            <div className="mb-2 flex items-center justify-start gap-2">
              <ModeToggle mode={inputMode} onChange={setInputMode} />
              {/* VoiceOutputToggle removido — voz é controlada pelo AstroOrb
                  (canto inferior direito). Modo "match-input" continua ativo
                  como default via useVoiceModeStore. */}
            </div>
            {inputMode === "composer" ? (
              <SlashComposer
                loading={loading}
                onSubmit={(prompt) => void submitCommand(prompt)}
              />
            ) : (
              <CommandInput {...commandInputProps} ref={commandInputRef} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "chat" | "composer";
  onChange: (m: "chat" | "composer") => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5"
      role="radiogroup"
      aria-label="Modo de input"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "chat"}
        onClick={() => onChange("chat")}
        title="Texto livre + voz"
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
          mode === "chat"
            ? "bg-violet-600/30 text-violet-200 ring-1 ring-violet-500/50"
            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        }`}
      >
        <MessageSquare className="size-3" />
        <span className="hidden sm:inline">Conversa</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "composer"}
        onClick={() => onChange("composer")}
        title="Chips estruturados (/CRIAR /LEAD…)"
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
          mode === "composer"
            ? "bg-violet-600/30 text-violet-200 ring-1 ring-violet-500/50"
            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        }`}
      >
        <SquareSlash className="size-3" />
        <span className="hidden sm:inline">Comando</span>
      </button>
    </div>
  );
}
