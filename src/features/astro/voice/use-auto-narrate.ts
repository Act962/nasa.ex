"use client";

import { useEffect, useRef } from "react";
import { isTextUIPart, type UIMessage } from "ai";
import { speak, cancel, isTtsSupported } from "./tts";
import { useVoiceModeStore, shouldSpeak } from "./use-voice-mode-store";

/**
 * Auto-narração das respostas do Astro.
 *
 * Quando o stream termina (status==="ready") E a última mensagem é do
 * assistente, extrai o texto consolidado das `parts.text` e dispara TTS
 * — mas só se o modo de output permitir (audio || match+lastInputWasVoice).
 *
 * Idempotente: usa ref do último ID narrado pra evitar repetir.
 */
export function useAutoNarrate(opts: {
  messages: UIMessage[];
  status: string; // "ready" | "streaming" | "submitted" | etc
}) {
  const { messages, status } = opts;
  const outputMode = useVoiceModeStore((s) => s.outputMode);
  const lastInputWasVoice = useVoiceModeStore((s) => s.lastInputWasVoice);
  const setSpeaking = useVoiceModeStore((s) => s.setSpeaking);
  const setLastInputWasVoice = useVoiceModeStore(
    (s) => s.setLastInputWasVoice,
  );
  const lastNarratedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    if (!isTtsSupported()) return;
    if (!shouldSpeak(outputMode, lastInputWasVoice)) {
      // Reset pra próxima entrada começar zerada
      if (lastInputWasVoice) setLastInputWasVoice(false);
      return;
    }

    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    if (lastAssistant.id === lastNarratedIdRef.current) return;

    const text = lastAssistant.parts
      .filter(isTextUIPart)
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (!text) return;

    lastNarratedIdRef.current = lastAssistant.id;
    setSpeaking(true);
    speak(text, {
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });

    // Consumiu a flag — próxima entrada deve setar de novo se for voz
    if (lastInputWasVoice) setLastInputWasVoice(false);
  }, [
    messages,
    status,
    outputMode,
    lastInputWasVoice,
    setSpeaking,
    setLastInputWasVoice,
  ]);

  // Interrompe TTS quando o componente desmonta
  useEffect(() => {
    return () => {
      cancel();
      setSpeaking(false);
    };
  }, [setSpeaking]);
}
