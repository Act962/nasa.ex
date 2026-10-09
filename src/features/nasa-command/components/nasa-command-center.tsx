"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";

import { orpc, client } from "@/lib/orpc";
import { useAstroChat } from "@/features/astro/hooks/use-astro-chat";
import { useHomeVoiceCall } from "../hooks/use-home-voice-call";
import { useAstroAttachments } from "@/features/astro/hooks/use-astro-attachments";
import { useAstro } from "@/features/astro/components/astro-provider";
import {
  readStoredCommandSessionId,
  storeCommandSessionId,
} from "@/features/astro/hooks/use-astro-widget-session";
import { useAutoNarrate } from "@/features/astro/voice/use-auto-narrate";
import { useVoiceModeStore } from "@/features/astro/voice/use-voice-mode-store";
import { useAstroOrbStore } from "@/features/astro/voice/use-astro-orb-store";
import { useSearchParams, useRouter } from "next/navigation";

import type { DropdownType, ModelType } from "../types";
import type { CommandInputHandle, CommandInputProps } from "./command-input";
import { SpaceScene } from "./space-scene";
import { HomeHeader } from "./home-header";
import { AstroPlusSheet } from "./astro-plus-sheet";
import { WelcomeScreen } from "./welcome-screen";
import { ConversationStack } from "./conversation-stack";
import { useHomeAlerts } from "./home-alerts-list";

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
  analytics_agent: "Explorando no universo ÓRBITA…",
};

export function NasaCommandCenter() {
  const [command, setCommand] = useState("");
  const [dropdown, setDropdown] = useState<DropdownType>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  // `model` continua na UI (model-selector) mas no MVP não influencia o
  // backend — o orquestrador usa ASTRO_DEFAULT_MODEL. Override do usuário
  // fica para iteração futura.
  const [model, setModel] = useState<ModelType>("astro");
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
    sendMessageWithAttachments,
    stop,
    error,
    setMessages,
    clearError,
    sessionId,
    ensureSession,
  } = useAstroChat({
    initialMessages: hydrated,
  });

  // Anexos (boleto, nota fiscal) da próxima mensagem — sobem antes do envio.
  const {
    attachments,
    readyAttachments,
    isUploading: isUploadingAttachment,
    addFiles,
    removeAttachment,
    clearAttachments,
  } = useAstroAttachments();

  const deleteSessionMutation = useMutation(
    orpc.astro.sessions.delete.mutationOptions({
      onSuccess: () => sessionsQuery.refetch(),
    }),
  );

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

  // A Início abre nas boas-vindas; a última conversa fica a um toque ("Últimas conversas").
  // Lido na primeira renderização, antes de qualquer efeito: o efeito que
  // grava roda com `sessionId` ainda nulo e apagaria o id guardado.
  const [storedSessionId] = useState(readStoredCommandSessionId);
  const lastConversationId = storedSessionId ?? sessionsQuery.data?.sessions[0]?.id ?? null;

  const openLastConversation = useCallback(() => {
    if (!lastConversationId) return;
    // Sessão apagada ou de outro usuário: avisa e esquece o id, sem quebrar a tela.
    void handleSelectSession(lastConversationId).catch(() => {
      storeCommandSessionId(null);
      toast.error("Não encontrei a última conversa. Veja o Histórico no +.");
    });
  }, [lastConversationId, handleSelectSession]);

  useEffect(() => {
    if (sessionId) storeCommandSessionId(sessionId);
  }, [sessionId]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      // Se a sessão atual foi apagada, limpa também o chat ativo.
      if (id === sessionId) {
        setMessages([]);
        setSessionId(null);
        storeCommandSessionId(null);
        setHydrated(undefined);
      }
      deleteSessionMutation.mutate({ id });
    },
    [sessionId, deleteSessionMutation, setMessages, setSessionId],
  );

  /**
   * "Nova sessão" — limpa o estado local; a próxima mensagem cria um
   * AiSession novo via `ensureSession()` no useAstroChat. O histórico
   * antigo continua salvo na lista.
   */
  const handleNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    storeCommandSessionId(null);
    setHydrated(undefined);
    setCommand("");
    clearError();
  }, [setMessages, setSessionId, clearError]);

  const submitCommand = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      const pendingAttachments = readyAttachments;
      // Com anexo, texto vazio é válido: o bloco [ARQUIVOS ANEXADOS] já diz
      // ao Astro o que fazer.
      if (
        (!trimmed && pendingAttachments.length === 0) ||
        status === "streaming" ||
        status === "submitted"
      ) {
        return;
      }
      setCommand("");
      setDropdown(null);
      clearAttachments();
      await sendMessageWithAttachments({
        text: trimmed || "Lê esse documento e me diz o que é.",
        attachments: pendingAttachments,
      });
      // Stars (mantém integração existente)
      queryClient.invalidateQueries({
        queryKey: orpc.stars.getBalance.queryOptions().queryKey,
      });
    },
    [status, sendMessageWithAttachments, readyAttachments, clearAttachments, queryClient],
  );

  const handleSubmit = async () => {
    if (!command.trim() && readyAttachments.length === 0) return;
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

  const homeVoiceCall = useHomeVoiceCall({
    messages,
    setMessages,
    submitCommand,
    ensureSession,
    onFallbackToBrowserVoice: () => commandInputRef.current?.startListening(),
  });

  // Auto-narração: quando o stream termina, narra a resposta do Astro
  // se o modo de output permitir (match + last input por voz, ou "audio").
  useAutoNarrate({ messages, status, isPaused: homeVoiceCall.isActive });

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
    if (!last) return ["Explorando…"];
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
            label: ROUTE_AGENT_LABELS[agentKey] ?? "Explorando no universo ÓRBITA",
            mode: "rocket" as const,
          };
        }
        return `Executando ${toolName}…`;
      });
    return inflight.length ? inflight : ["Explorando…"];
  }, [messages, loading]);

  const [isPlusSheetOpen, setIsPlusSheetOpen] = useState(false);
  const { alertGroups } = useHomeAlerts();
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
    attachments,
    onAddFiles: (files: File[]) => void addFiles(files),
    onRemoveAttachment: removeAttachment,
    isUploadingAttachment,
    onOpenPlus: () => setIsPlusSheetOpen(true),
    plusBadgeCount: alertGroups.length,
    voiceCall: homeVoiceCall.voiceCall,
  };

  const recentSessions = (sessionsQuery.data?.sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    lastAgentKey: s.lastAgentKey,
    updatedAt: s.updatedAt,
  }));

  return (
    // A Início é um cenário espacial: sempre no tema escuro, nos dois modos.
    <div
      data-home-space
      className="dark h-full flex flex-col bg-background text-foreground relative overflow-hidden"
      style={{ cursor: "url('/cursors/rocket.svg') 6 4, auto" }}
    >
      <SpaceScene />
      <HomeHeader />

      <div data-home-scroll className="flex-1 overflow-y-auto relative z-10">
        <WelcomeScreen
          isConversationActive={hasMessages}
          onOpenLastConversation={!hasMessages && lastConversationId ? openLastConversation : undefined}
          commandInputProps={commandInputProps}
          commandInputRef={commandInputRef}
          conversation={
            hasMessages ? (
              <ConversationStack
                messages={messages}
                loading={loading}
                thinkingSteps={thinkingSteps}
                error={error}
                sessionId={sessionId}
                onRespond={(text) => void submitCommand(text)}
              />
            ) : null
          }
        />
      </div>
      <AstroPlusSheet
        open={isPlusSheetOpen}
        onOpenChange={setIsPlusSheetOpen}
        onSelectExample={fillExample}
        onPrompt={(prompt) => void submitCommand(prompt)}
        sessions={recentSessions}
        sessionsLoading={sessionsQuery.isLoading}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onAfterRenameSession={() => sessionsQuery.refetch()}
        onNewSession={handleNewSession}
        onAddFiles={commandInputProps.onAddFiles}
      />
    </div>
  );
}
