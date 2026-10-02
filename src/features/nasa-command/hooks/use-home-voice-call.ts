"use client";

import { useCallback, useEffect, useRef } from "react";
import { isTextUIPart, type UIMessage } from "ai";
import { toast } from "sonner";
import { useRealtimeVoice, type VoiceCallErrorCode, type VoiceTurn } from "@/features/astro/voice/realtime/use-realtime-voice";
import { useAppendAstroVoiceTurns } from "@/features/astro/hooks/use-astro-voice-turns";
import { useSetAstroAiMode } from "@/features/astro/hooks/use-astro-ai-mode";
import { useAstroModelPreference } from "@/features/astro/composer/use-astro-model-preference";

/** Liga a chamada de voz em tempo real à conversa da Início: balões, consulta ao ASTRO e Histórico (spec 0054). */

const REPLY_POLL_ATTEMPTS = 20;
const REPLY_POLL_INTERVAL_MS = 100;
const MAX_SPOKEN_ANSWER_CHARS = 1500;

function toSpokenAnswer(reply: UIMessage | undefined): string {
  const replyText = (reply?.parts ?? [])
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join(" ")
    .trim();
  if (!replyText) return "O ASTRO mostrou a resposta na tela, num cartão.";
  return replyText.slice(0, MAX_SPOKEN_ANSWER_CHARS);
}

interface UseHomeVoiceCallOptions {
  messages: UIMessage[];
  setMessages: (updater: (current: UIMessage[]) => UIMessage[]) => void;
  submitCommand: (text: string) => Promise<void>;
  ensureSession: () => Promise<string>;
  /** Navegador sem WebRTC: cai no reconhecimento de voz antigo (RF-9). */
  onFallbackToBrowserVoice: () => void;
}

export function useHomeVoiceCall({
  messages,
  setMessages,
  submitCommand,
  ensureSession,
  onFallbackToBrowserVoice,
}: UseHomeVoiceCallOptions) {
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const callTurnsRef = useRef<VoiceTurn[]>([]);
  const appendVoiceTurns = useAppendAstroVoiceTurns();
  const setAstroAiMode = useSetAstroAiMode();
  const activeVoiceModelId = useAstroModelPreference((state) => state.activeVoiceModelId);

  const askAstro = useCallback(
    async (question: string) => {
      const knownMessageIds = new Set(messagesRef.current.map((message) => message.id));
      await submitCommand(question);
      for (let attempt = 0; attempt < REPLY_POLL_ATTEMPTS; attempt++) {
        const reply = [...messagesRef.current]
          .reverse()
          .find((message) => message.role === "assistant" && !knownMessageIds.has(message.id));
        if (reply) return toSpokenAnswer(reply);
        await new Promise((resolve) => setTimeout(resolve, REPLY_POLL_INTERVAL_MS));
      }
      return "A resposta apareceu na tela.";
    },
    [submitCommand],
  );

  const handleTurn = useCallback(
    (turn: VoiceTurn) => {
      callTurnsRef.current.push(turn);
      setMessages((current) =>
        current.some((message) => message.id === turn.id)
          ? current
          : [...current, { id: turn.id, role: turn.role, parts: [{ type: "text", text: turn.text }] }],
      );
    },
    [setMessages],
  );

  const handleCallEnded = useCallback(async () => {
    const callTurns = callTurnsRef.current;
    callTurnsRef.current = [];
    if (callTurns.length === 0) return;
    try {
      const sessionId = await ensureSession();
      appendVoiceTurns.mutate({ sessionId, turns: callTurns });
    } catch (persistError) {
      console.warn("[astro/voice] falas não entraram no Histórico:", persistError);
    }
  }, [appendVoiceTurns, ensureSession]);

  const startCallRef = useRef<() => void>(() => undefined);

  const handleError = useCallback(
    (code: VoiceCallErrorCode, message: string) => {
      if (code === "UNSUPPORTED" || code === "VOICE_DISABLED") {
        onFallbackToBrowserVoice();
        return;
      }
      if (code === "CHOOSE_AI") {
        toast("Dê inteligência ao ASTRO", {
          description: "Conecte a IA da sua empresa em Satélites ou use o modelo ÓRBITA para conversar por voz.",
          action: {
            label: "Usar modelo ÓRBITA",
            onClick: () => setAstroAiMode.mutate({ mode: "PLATFORM" }, { onSuccess: () => startCallRef.current() }),
          },
        });
        return;
      }
      toast.error(message);
    },
    [onFallbackToBrowserVoice, setAstroAiMode],
  );

  const voice = useRealtimeVoice({
    askAstro,
    onTurn: handleTurn,
    onError: handleError,
    onCallEnded: () => void handleCallEnded(),
  });
  useEffect(() => {
    startCallRef.current = () => void voice.startCall();
  }, [voice]);

  return {
    isActive: voice.isActive,
    voiceCall: {
      // Nenhum modelo de voz ligado no "Uso do ASTRO": o botão de conversa por voz some.
      isAvailable: activeVoiceModelId !== null,
      status: voice.status,
      elapsedSeconds: voice.elapsedSeconds,
      isMuted: voice.isMuted,
      // Voz econômica: o navegador ouve, o ASTRO responde em texto e a OpenAI lê (sem chamada ao vivo).
      onStart: () =>
        useAstroModelPreference.getState().voiceMode === "standard" ? onFallbackToBrowserVoice() : void voice.startCall(),
      onEnd: voice.endCall,
      onToggleMute: voice.toggleMute,
    },
  };
}
