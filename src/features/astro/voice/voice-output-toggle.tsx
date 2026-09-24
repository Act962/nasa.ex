"use client";

import {
  Volume2,
  MessageSquare,
  Repeat2,
  Square,
  Pause,
  Play,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  cancel as cancelTts,
  pause as pauseTts,
  resume as resumeTts,
  isTtsSupported,
  isPiperDegraded,
  onEngineChange,
  probePiperHealth,
} from "./tts";
import { useEffect, useState } from "react";
import {
  useVoiceModeStore,
  type VoiceOutputMode,
} from "./use-voice-mode-store";

/**
 * Segmented control compacto pra escolher o modo de saída do Astro:
 *   - 💬 Texto: nunca narra
 *   - 🔁 Espelhar: narra se a entrada foi por voz (default)
 *   - 🔊 Áudio: sempre narra
 *
 * Quando o Astro está falando, mostra pausar e parar inline. Pausar retoma na
 * mesma palavra; parar descarta o resto da fila.
 *
 * Silencioso quando o browser não suporta TTS — não aparece, não polui UI.
 */

const OPTIONS: Array<{
  value: VoiceOutputMode;
  label: string;
  Icon: typeof Volume2;
  hint: string;
}> = [
  {
    value: "text",
    label: "Texto",
    Icon: MessageSquare,
    hint: "Nunca narrar respostas",
  },
  {
    value: "match",
    label: "Espelhar",
    Icon: Repeat2,
    hint: "Narrar só quando você fala (default)",
  },
  {
    value: "audio",
    label: "Áudio",
    Icon: Volume2,
    hint: "Sempre narrar respostas",
  },
];

export function VoiceOutputToggle({ className }: { className?: string }) {
  const outputMode = useVoiceModeStore((s) => s.outputMode);
  const setOutputMode = useVoiceModeStore((s) => s.setOutputMode);
  const isSpeaking = useVoiceModeStore((s) => s.isSpeaking);
  const setSpeaking = useVoiceModeStore((s) => s.setSpeaking);
  const [paused, setPaused] = useState(false);
  // A queda do Piper era invisível: o fallback entrava sozinho e a voz
  // simplesmente piorava, sem ninguém saber por quê.
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const unsubscribe = onEngineChange(() => setDegraded(isPiperDegraded()));
    // Checa na montagem: sem isto o aviso só apareceria depois da primeira
    // fala ruim, quando o estrago de percepção já aconteceu.
    void probePiperHealth().then(() => setDegraded(isPiperDegraded()));
    return unsubscribe;
  }, []);

  // SSR-safe: na primeira render, o store pode estar com o default,
  // mas o suporte ao TTS só é checável no client.
  if (typeof window !== "undefined" && !isTtsSupported()) return null;

  const handleStop = () => {
    cancelTts();
    setPaused(false);
    setSpeaking(false);
  };

  const handleTogglePause = () => {
    if (paused) {
      resumeTts();
      setPaused(false);
      return;
    }
    pauseTts();
    setPaused(true);
  };

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div
        className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5"
        role="radiogroup"
        aria-label="Modo de saída do Astro"
      >
        {OPTIONS.map(({ value, label, Icon, hint }) => {
          const active = outputMode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              title={hint}
              onClick={() => setOutputMode(value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                active
                  ? "bg-violet-600/30 text-violet-200 ring-1 ring-violet-500/50"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
              )}
            >
              <Icon className="size-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {degraded && (
        <span
          title="A voz natural (Piper) está fora do ar e o Astro caiu para a voz do navegador. Rode `docker compose up piper -d` para recuperá-la."
          className="inline-flex items-center gap-1 rounded-md border border-amber-600/40 bg-amber-600/10 px-2 py-1 text-[11px] text-amber-300"
        >
          <TriangleAlert className="size-3" />
          <span className="hidden sm:inline">Voz simplificada</span>
        </span>
      )}

      {isSpeaking && (
        <button
          type="button"
          onClick={handleTogglePause}
          title={paused ? "Continuar fala" : "Pausar fala"}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700/60"
        >
          {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          <span className="hidden sm:inline">{paused ? "Continuar" : "Pausar"}</span>
        </button>
      )}

      {isSpeaking && (
        <button
          type="button"
          onClick={handleStop}
          title="Parar fala"
          className="inline-flex items-center gap-1 rounded-md border border-red-600/40 bg-red-600/15 px-2 py-1 text-[11px] text-red-300 hover:bg-red-600/25 transition-colors"
        >
          <Square className="size-3 fill-current" />
          <span className="hidden sm:inline">Parar</span>
        </button>
      )}
    </div>
  );
}
