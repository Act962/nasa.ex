"use client";

import { EyeOff, HeadphoneOff, Headphones, Mic } from "lucide-react";
import { useAstroOrbStore } from "./use-astro-orb-store";
import { useAstroWidgetStore } from "./use-astro-widget-store";
import { useAstroVoiceActions } from "./use-astro-voice-actions";
import { unlockAudio } from "./tts";

/**
 * Itens do menu de voz do Astro: falar, escuta "ASTRO" e esconder o orb.
 * Usado no menu do orb (no /home) e no cabeçalho do painel de chat (spec 0015).
 */
export function AstroVoiceMenuItems({ onAction }: { onAction?: () => void }) {
  const wakeWordEnabled = useAstroOrbStore((state) => state.wakeWordEnabled);
  const setVisible = useAstroOrbStore((state) => state.setVisible);
  const closeWidget = useAstroWidgetStore((state) => state.close);
  const { captureUtterance, toggleWakeWord } = useAstroVoiceActions();

  return (
    <>
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
