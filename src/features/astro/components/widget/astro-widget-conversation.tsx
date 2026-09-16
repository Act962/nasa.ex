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
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { useVoiceModeStore } from "@/features/astro/voice/use-voice-mode-store";
import { AstroWidgetComposer } from "./astro-widget-composer";
import { AstroWidgetEmptyState } from "./astro-widget-empty-state";
import { AstroWidgetHeader } from "./astro-widget-header";
import { AstroWidgetMessages } from "./astro-widget-messages";

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
    useAstroChat({ initialMessages, onFinish: () => incrementUnread() });
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
      <AstroWidgetMessages
        messages={messages}
        loading={loading}
        error={error}
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
      />
    </>
  );
}
