"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Headphones,
  HeadphoneOff,
  Mic,
  Loader2,
  Volume2,
  Sparkles,
  X,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAstroOrbStore } from "./use-astro-orb-store";
import { useVoiceModeStore } from "./use-voice-mode-store";
import { useWakeWord } from "./use-wake-word";

/**
 * AstroOrb — o "pet" flutuante do Astro.
 *
 * - Mountado globalmente no platform-providers.
 * - Sempre visível (a menos que user esconda).
 * - Quando wake word `enabled=true`, escuta continuamente pela palavra "ASTRO".
 * - Quando detecta wake word: vira "listening", captura próxima fala em
 *   janela curta (max 8s), grava em `pendingUtterance`, navega pra `/home`
 *   com `?prompt=…` se ainda não estiver lá. NASA Command consome.
 *
 * Privacy: indicador visual permanente quando wake word ON. Click no orb
 * abre menu com toggle + esconder.
 *
 * Pausa wake word enquanto `isSpeaking=true` (TTS) — não pega a própria
 * voz do Astro como wake.
 */
export function AstroOrb() {
  const visible = useAstroOrbStore((s) => s.visible);
  const phase = useAstroOrbStore((s) => s.phase);
  const wakeWordEnabled = useAstroOrbStore((s) => s.wakeWordEnabled);
  const hint = useAstroOrbStore((s) => s.hint);
  const setPhase = useAstroOrbStore((s) => s.setPhase);
  const setHint = useAstroOrbStore((s) => s.setHint);
  const setWakeWordEnabled = useAstroOrbStore((s) => s.setWakeWordEnabled);
  const setVisible = useAstroOrbStore((s) => s.setVisible);
  const setPendingUtterance = useAstroOrbStore((s) => s.setPendingUtterance);

  const isSpeaking = useVoiceModeStore((s) => s.isSpeaking);

  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Sync TTS speaking → phase visual
  useEffect(() => {
    if (isSpeaking && phase !== "speaking") {
      setPhase("speaking");
    } else if (!isSpeaking && phase === "speaking") {
      setPhase("idle");
    }
  }, [isSpeaking, phase, setPhase]);

  // Captura utterance após wake word
  const captureUtterance = useCallback(() => {
    if (typeof window === "undefined") return;
    const SRApi = window as unknown as {
      SpeechRecognition?: typeof SpeechRecognition;
      webkitSpeechRecognition?: typeof SpeechRecognition;
    };
    const SR = SRApi.SpeechRecognition ?? SRApi.webkitSpeechRecognition;
    if (!SR) return;

    setPhase("listening");
    setHint("Te ouvindo…");

    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    let captured = "";
    let resolved = false;

    const resolve = (text: string) => {
      if (resolved) return;
      resolved = true;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      const t = text.trim();
      if (t) {
        setPhase("thinking");
        setHint(`"${t}"`);
        setPendingUtterance(t);
        // Se não estamos no /home, navegar com prompt na URL.
        if (pathname !== "/home") {
          const url = `/home?prompt=${encodeURIComponent(t)}`;
          router.push(url);
        }
      } else {
        setPhase("idle");
        setHint(null);
      }
      // Limpa hint depois de 2s
      setTimeout(() => setHint(null), 2500);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript ?? "";
      captured = transcript;
    };
    rec.onerror = () => resolve(captured);
    rec.onend = () => resolve(captured);

    try {
      rec.start();
    } catch {
      resolve("");
    }

    // Timeout 8s — fecha mesmo se o STT não disparar `end`
    setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      resolve(captured);
    }, 8000);
  }, [pathname, router, setPhase, setHint, setPendingUtterance]);

  // Wake word loop
  useWakeWord({
    enabled: wakeWordEnabled && phase === "idle",
    paused: isSpeaking, // não pega a própria voz do TTS
    onWake: () => {
      captureUtterance();
    },
    onError: (err) => {
      // Erro de permissão → desliga wake word + avisa
      if (err === "not-allowed" || err === "service-not-allowed") {
        setWakeWordEnabled(false);
        setHint("Permissão de microfone negada");
        setTimeout(() => setHint(null), 3000);
      }
    },
  });

  if (!visible) return null;

  const handleOrbClick = () => {
    // Se estamos em listening/thinking/speaking, click cancela
    if (phase !== "idle") {
      setPhase("idle");
      setHint(null);
      return;
    }
    // Senão, abre menu
    setMenuOpen((o) => !o);
  };

  const handleManualActivate = () => {
    setMenuOpen(false);
    captureUtterance();
  };

  const handleToggleWakeWord = () => {
    setWakeWordEnabled(!wakeWordEnabled);
  };

  const phaseStyle = ORB_PHASES[phase];

  return (
    <div
      className="fixed bottom-5 right-5 z-[9000] flex flex-col items-end gap-2 pointer-events-none"
      style={{
        // Não interfere em selectors/click outside no resto da página
        // (só os elementos interativos abaixo têm pointer-events).
      }}
    >
      {/* Hint flutuante */}
      {hint && (
        <div
          className="pointer-events-auto rounded-2xl bg-zinc-900/95 backdrop-blur border border-zinc-700/60 px-3 py-1.5 text-xs text-zinc-100 shadow-lg max-w-xs animate-in fade-in slide-in-from-bottom-1 duration-200"
          aria-live="polite"
        >
          {hint}
        </div>
      )}

      {/* Menu (quando aberto) */}
      {menuOpen && (
        <div
          className="pointer-events-auto rounded-xl bg-zinc-900/95 backdrop-blur border border-zinc-700/60 shadow-xl overflow-hidden"
          role="menu"
        >
          <button
            type="button"
            onClick={handleManualActivate}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          >
            <Mic className="size-3.5" />
            Falar com o Astro
          </button>
          <button
            type="button"
            onClick={handleToggleWakeWord}
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
            onClick={() => {
              setVisible(false);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800/80 transition-colors border-t border-zinc-800"
          >
            <EyeOff className="size-3.5" />
            Esconder orb
          </button>
        </div>
      )}

      {/* O orb propriamente */}
      <button
        type="button"
        onClick={handleOrbClick}
        title={
          phase === "listening"
            ? "Cancelar captura"
            : phase === "thinking"
              ? "Astro processando"
              : phase === "speaking"
                ? "Astro falando"
                : wakeWordEnabled
                  ? "Escutando 'ASTRO' — click pra menu"
                  : "Astro — click pra falar"
        }
        aria-label="Astro Orb"
        className={cn(
          "pointer-events-auto relative size-12 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95",
          phaseStyle.bg,
          phaseStyle.ring,
          phase === "listening" && "animate-pulse",
        )}
      >
        {/* Halo de pulso pra listening — anel externo expandindo */}
        {phase === "listening" && (
          <span
            className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping"
            aria-hidden
          />
        )}
        {/* Halo permanente sutil quando wake word ON */}
        {wakeWordEnabled && phase === "idle" && (
          <span
            className="absolute -inset-1 rounded-full bg-emerald-500/20 blur-sm"
            aria-hidden
          />
        )}

        <span className="relative z-10 text-white">
          {phase === "listening" ? (
            <Mic className="size-5" />
          ) : phase === "thinking" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : phase === "speaking" ? (
            <Volume2 className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </span>

        {/* Indicador de wake word ativo no canto */}
        {wakeWordEnabled && phase === "idle" && (
          <span
            className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-zinc-950"
            aria-label="Escuta ativa"
          />
        )}
      </button>

      {/* Botão de fechar menu — overlay invisível */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-[8999] cursor-default pointer-events-auto bg-transparent"
        >
          <X className="hidden" />
        </button>
      )}
    </div>
  );
}

const ORB_PHASES: Record<
  "idle" | "listening" | "thinking" | "speaking",
  { bg: string; ring: string }
> = {
  idle: {
    bg: "bg-gradient-to-br from-violet-600 to-purple-700",
    ring: "ring-2 ring-violet-500/40",
  },
  listening: {
    bg: "bg-gradient-to-br from-blue-500 to-blue-700",
    ring: "ring-4 ring-blue-400/60",
  },
  thinking: {
    bg: "bg-gradient-to-br from-purple-500 to-fuchsia-700",
    ring: "ring-2 ring-fuchsia-400/60",
  },
  speaking: {
    bg: "bg-gradient-to-br from-emerald-500 to-teal-700",
    ring: "ring-4 ring-emerald-400/60",
  },
};
