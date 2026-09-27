"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { UIMessage } from "ai";
import { useAstro } from "@/features/astro/components/astro-provider";
import { useAstroChat } from "@/features/astro/hooks/use-astro-chat";
import { useAstroAttachments } from "@/features/astro/hooks/use-astro-attachments";
import { storeWidgetSessionId } from "@/features/astro/hooks/use-astro-widget-session";
import { useAutoNarrate } from "@/features/astro/voice/use-auto-narrate";
import { useAstroOrbStore } from "@/features/astro/voice/use-astro-orb-store";
import { useAstroFeedStore } from "@/features/astro/voice/use-astro-feed-store";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { useVoiceModeStore } from "@/features/astro/voice/use-voice-mode-store";
import { AstroWidgetComposer } from "./astro-widget-composer";
import { AstroWidgetEmptyState } from "./astro-widget-empty-state";
import { AstroWidgetHeader } from "./astro-widget-header";
import { AstroWidgetMessages } from "./astro-widget-messages";
import { AstroWidgetApprovals } from "@/features/astro-commander/components/astro-widget-approvals";
import { useAstroPendingApprovals } from "@/features/astro-commander/hooks/use-astro-pending-approvals";
import { useNotifications } from "@/components/sidebar/hooks/use-notifications";
import { AstroWidgetHome } from "./astro-widget-home";
import { AstroWidgetTabs } from "./astro-widget-tabs";
import { hasOpenPicker } from "@/features/astro/lib/astro-action-result";

/**
 * A conversa do painel: mesmo motor do /home (`useAstroChat`), com anexos,
 * cartão de confirmação e contexto da rota (spec 0015, RF-2).
 */

// Com anexo e sem texto, o bloco [ARQUIVOS ANEXADOS] já diz ao Astro o que fazer.
const ATTACHMENT_ONLY_PROMPT = "Lê esse documento e me diz o que é.";

export function AstroWidgetConversation({ initialMessages }: { initialMessages?: UIMessage[] }) {
  const pathname = usePathname();
  const { sessionId, setSessionId } = useAstro();
  const pendingPrompt = useAstroWidgetStore((state) => state.pendingPrompt);
  const consumePendingPrompt = useAstroWidgetStore((state) => state.consumePendingPrompt);
  const incrementUnread = useAstroWidgetStore((state) => state.incrementUnread);
  const closeWidget = useAstroWidgetStore((state) => state.close);
  const setLastInputWasVoice = useVoiceModeStore((state) => state.setLastInputWasVoice);
  const [draft, setDraft] = useState("");

  const { messages, status, error, stop, setMessages, clearError, sendMessageWithAttachments } =
    useAstroChat({
      initialMessages,
      onFinish: () => {
        incrementUnread();
        // Painel fechado: a resposta pronta vira um aviso no balão do orb.
        if (!useAstroWidgetStore.getState().isOpen) {
          useAstroFeedStore.getState().push(
            {
              id: "chat-answer-ready",
              kind: "alert",
              headline: "Resposta pronta",
              detail: "Toque para ver o que o Astro respondeu.",
              priority: "info",
              openView: "chat",
            },
            8_000,
          );
        }
      },
    });
  const {
    attachments,
    readyAttachments,
    isUploading,
    addFiles,
    removeAttachment,
    clearAttachments,
  } = useAstroAttachments();

  const loading = status === "submitted" || status === "streaming";

  // A conversa do painel sobrevive a refresh da aba (RF-4).
  useEffect(() => {
    storeWidgetSessionId(sessionId);
  }, [sessionId]);

  const isWidgetOpen = useAstroWidgetStore((state) => state.isOpen);
  const view = useAstroWidgetStore((state) => state.view);
  const setView = useAstroWidgetStore((state) => state.setView);
  const { unread: unreadAlerts } = useNotifications();
  const { pendingCount: pendingApprovals } = useAstroPendingApprovals();
  const homeBadge = unreadAlerts + pendingApprovals;

  // Painel fechado com resposta em andamento: o orb avisa que o ASTRO está
  // trabalhando, em vez de ficar parado até o contador aparecer (spec 0029, RF-10).
  useEffect(() => {
    const feed = useAstroFeedStore.getState();
    const respondingId = "chat-responding";
    if (loading && !isWidgetOpen) {
      feed.push({
        id: respondingId,
        kind: "activity",
        headline: "Astro respondendo…",
        detail: "Te aviso aqui quando terminar.",
        priority: "info",
      });
      return;
    }
    feed.remove(respondingId);
  }, [loading, isWidgetOpen]);

  const submit = useCallback(
    async (text: string, options: { fromVoice?: boolean } = {}) => {
      const trimmedText = text.trim();
      if ((!trimmedText && readyAttachments.length === 0) || loading || isUploading) return;
      // Decide se a resposta é narrada no modo "igual à entrada".
      setLastInputWasVoice(Boolean(options.fromVoice));
      const attachmentsToSend = readyAttachments;
      setDraft("");
      clearAttachments();
      clearError();
      await sendMessageWithAttachments({
        text: trimmedText || ATTACHMENT_ONLY_PROMPT,
        attachments: attachmentsToSend,
      });
    },
    [
      readyAttachments,
      loading,
      isUploading,
      setLastInputWasVoice,
      clearAttachments,
      clearError,
      sendMessageWithAttachments,
    ],
  );

  // Prompt vindo de voz ou do evento `astro:open`. Com resposta em andamento,
  // espera ela terminar (CB-3).
  useEffect(() => {
    if (!pendingPrompt || loading) return;
    const prompt = consumePendingPrompt();
    if (prompt) void submit(prompt.text, { fromVoice: prompt.fromVoice });
  }, [pendingPrompt, loading, consumePendingPrompt, submit]);

  // Terminou de responder: o orb sai de "pensando". Se o TTS for falar, o
  // próprio orb passa para "falando" a partir do store de voz.
  useEffect(() => {
    if (status !== "ready") return;
    const orbState = useAstroOrbStore.getState();
    if (orbState.phase === "thinking") orbState.setPhase("idle");
  }, [status]);

  useAutoNarrate({ messages, status });

  const startNewConversation = useCallback(() => {
    void stop();
    setMessages([]);
    setSessionId(null);
    storeWidgetSessionId(null);
    clearAttachments();
    clearError();
    setDraft("");
  }, [stop, setMessages, setSessionId, clearAttachments, clearError]);

  return (
    <>
      <AstroWidgetHeader
        pathname={pathname}
        canStartNewConversation={messages.length > 0}
        onNewConversation={startNewConversation}
        onClose={closeWidget}
      />
      <AstroWidgetTabs view={view} onViewChange={setView} homeBadge={homeBadge} />
      {view === "home" ? (
        <AstroWidgetHome pathname={pathname} />
      ) : (
        <>
      <AstroWidgetApprovals />
      <AstroWidgetMessages
        messages={messages}
        loading={loading}
        error={error}
        sessionId={sessionId ?? undefined}
        onRespond={(text) => void submit(text)}
        emptyState={
          <AstroWidgetEmptyState
            pathname={pathname}
            disabled={loading}
            onSelect={(text) => void submit(text)}
          />
        }
      />
      <AstroWidgetComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={() => void submit(draft)}
        onStop={() => void stop()}
        loading={loading}
        attachments={attachments}
        isUploading={isUploading}
        onAddFiles={(files) => void addFiles(files)}
        onRemoveAttachment={removeAttachment}
        isLockedByPicker={hasOpenPicker(messages)}
      />
        </>
      )}
    </>
  );
}
