"use client";

import { EyeOff, HeadphoneOff, Headphones, Mic, Pause, Play, TriangleAlert } from "lucide-react";
import { useAstroOrbStore } from "./use-astro-orb-store";
import { useAstroWidgetStore } from "./use-astro-widget-store";
import { useAstroVoiceActions } from "./use-astro-voice-actions";
import { useEffect, useState } from "react";
import {
  unlockAudio,
  pause as pauseTts,
  resume as resumeTts,
  isPiperDegraded,
  onEngineChange,
  probePiperHealth,
} from "./tts";
import { useVoiceModeStore } from "./use-voice-mode-store";

/**
 * Itens do menu de voz do Astro: falar, escuta "ASTRO" e esconder o orb.
 * Usado no menu do orb (no /home) e no cabeçalho do painel de chat (spec 0015).
 */
export function AstroVoiceMenuItems({ onAction }: { onAction?: () => void }) {
  const wakeWordEnabled = useAstroOrbStore((state) => state.wakeWordEnabled);
  const setVisible = useAstroOrbStore((state) => state.setVisible);
  const closeWidget = useAstroWidgetStore((state) => state.close);
  const { captureUtterance, toggleWakeWord } = useAstroVoiceActions();
  const isSpeaking = useVoiceModeStore((state) => state.isSpeaking);
  const [paused, setPaused] = useState(false);
  // A queda do Piper era invisível: o fallback entrava sozinho e o usuário
  // concluía que a voz do produto é ruim.
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const unsubscribe = onEngineChange(() => setDegraded(isPiperDegraded()));
    void probePiperHealth().then(() => setDegraded(isPiperDegraded()));
    return unsubscribe;
  }, []);

  return (
    <>
      {isSpeaking && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            if (paused) {
              resumeTts();
              setPaused(false);
              return;
            }
            pauseTts();
            setPaused(true);
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800/80 transition-colors"
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {paused ? "Continuar a fala" : "Pausar a fala"}
        </button>
      )}

      {degraded && (
        <div
          className="flex items-start gap-2 border-b border-zinc-800 px-3 py-2 text-[11px] text-amber-300/90"
          title="Rode `docker compose up piper -d` para recuperar a voz natural."
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Voz simplificada — a voz natural está fora do ar.
          </span>
        </div>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          // Destrava áudio dentro do gesto antes de qualquer async (iOS).
          unlockAudio();
          onAction?.();
          // Clique manual: pula a saudação — o usuário já decidiu falar.
          captureUtterance({ withGreeting: false });
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800/80 transition-colors"
      >
        <Mic className="size-3.5" />
        Falar com o Astro
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => void toggleWakeWord()}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800/80 transition-colors border-t border-zinc-800"
      >
        {wakeWordEnabled ? (
          <>
            <HeadphoneOff className="size-3.5 text-amber-400" />
            Desativar escuta ("ASTRO")
          </>
        ) : (
          <>
            <Headphones className="size-3.5 text-emerald-400" />
            Ativar escuta ("ASTRO")
          </>
        )}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          // Sem o orb, o painel ficaria sem como ser reaberto: fecha junto.
          setVisible(false);
          closeWidget();
          onAction?.();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800/80 transition-colors border-t border-zinc-800"
      >
        <EyeOff className="size-3.5" />
        Esconder orb
      </button>
    </>
  );
}
