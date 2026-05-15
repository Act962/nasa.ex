"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Modo de saída do Astro:
 *  - "text": só renderiza texto (default conservador)
 *  - "audio": SEMPRE narra (mesmo quando user digitou)
 *  - "match": match-input — narra apenas quando a entrada foi por voz
 *    (default sensato — respeita contexto do usuário)
 */
export type VoiceOutputMode = "text" | "audio" | "match";

interface VoiceModeStore {
  outputMode: VoiceOutputMode;
  /** True quando o último input foi por voz — usado pelo modo "match". */
  lastInputWasVoice: boolean;
  /** True enquanto o TTS está falando — pra UI mostrar feedback. */
  isSpeaking: boolean;

  setOutputMode: (m: VoiceOutputMode) => void;
  setLastInputWasVoice: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
}

export const useVoiceModeStore = create<VoiceModeStore>()(
  persist(
    (set) => ({
      outputMode: "match", // default: match-input
      lastInputWasVoice: false,
      isSpeaking: false,

      setOutputMode: (outputMode) => set({ outputMode }),
      setLastInputWasVoice: (lastInputWasVoice) => set({ lastInputWasVoice }),
      setSpeaking: (isSpeaking) => set({ isSpeaking }),
    }),
    {
      name: "astro-voice-mode", // localStorage key
      partialize: (state) => ({ outputMode: state.outputMode }),
    },
  ),
);

/** Decide se deve narrar uma resposta com base no modo + último input. */
export function shouldSpeak(
  mode: VoiceOutputMode,
  lastInputWasVoice: boolean,
): boolean {
  if (mode === "audio") return true;
  if (mode === "text") return false;
  return lastInputWasVoice; // match
}
