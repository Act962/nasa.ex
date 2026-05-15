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
import { authClient } from "@/lib/auth-client";
import { useAstroOrbStore } from "./use-astro-orb-store";
import { useVoiceModeStore } from "./use-voice-mode-store";
import { useWakeWord } from "./use-wake-word";
import { speak } from "./tts";

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
  const setVoiceSpeaking = useVoiceModeStore((s) => s.setSpeaking);

  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Saudação proativa: precisa do primeiro nome do usuário pra falar
  // "Opa Wey…" quando o wake word dispara.
  const { data: session } = authClient.useSession();
  const firstName = extractFirstName(session?.user?.name);

  // Sync TTS speaking → phase visual
  useEffect(() => {
    if (isSpeaking && phase !== "speaking") {
      setPhase("speaking");
    } else if (!isSpeaking && phase === "speaking") {
      setPhase("idle");
    }
  }, [isSpeaking, phase, setPhase]);

  // Captura utterance — quando triggerada por wake word, fala uma saudação
  // proativa antes ("Opa Wey, como posso ajudar?"). Quando triggerada por
  // click manual, pula direto pra escuta (user já abriu o menu).
  const captureUtterance = useCallback(
    (opts: { withGreeting?: boolean } = {}) => {
      if (typeof window === "undefined") return;
      const SRApi = window as unknown as {
        SpeechRecognition?: typeof SpeechRecognition;
        webkitSpeechRecognition?: typeof SpeechRecognition;
      };
      const SRCtor = SRApi.SpeechRecognition ?? SRApi.webkitSpeechRecognition;
      if (!SRCtor) return;
      // Narrow para closure interna
      const SR: NonNullable<typeof SRCtor> = SRCtor;

      const startCapture = () => {
        // Estado visual já está em listening por causa do effect do TTS;
        // garante explicitamente caso a saudação não tenha disparado.
        setPhase("listening");
        setHint("Te ouvindo…");
        runRecognition();
      };

      if (opts.withGreeting) {
        // Saudação contextual — usa primeiro nome + hora do dia
        const greeting = buildGreeting(firstName);
        setPhase("speaking");
        setHint(greeting);
        setVoiceSpeaking(true);
        speak(greeting, {
          onEnd: () => {
            setVoiceSpeaking(false);
            startCapture();
          },
          onError: () => {
            setVoiceSpeaking(false);
            startCapture();
          },
        });
        return;
      }

      startCapture();

      function runRecognition() {
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
      }
    },
    [
      pathname,
      router,
      setPhase,
      setHint,
      setPendingUtterance,
      setVoiceSpeaking,
      firstName,
    ],
  );

  // Wake word loop — quando dispara, Astro saúda antes de escutar
  useWakeWord({
    enabled: wakeWordEnabled && phase === "idle",
    paused: isSpeaking, // não pega a própria voz do TTS
    onWake: () => {
      captureUtterance({ withGreeting: true });
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
    // Manual click: pula saudação — user já decidiu falar.
    captureUtterance({ withGreeting: false });
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

/**
 * Pega só o primeiro nome do usuário pra usar em saudações.
 * Fallback: "amigo" — neutro, evita "Opa undefined, como posso te ajudar?".
 */
function extractFirstName(fullName?: string | null): string {
  if (!fullName) return "amigo";
  const first = fullName.trim().split(/\s+/)[0];
  return first || "amigo";
}

/**
 * Saudação contextual baseada na hora do dia (fuso local do browser).
 * Curta — não soa robótico em TTS. Varia pra não cansar o ouvido (3 templates
 * por turno).
 */
function buildGreeting(firstName: string): string {
  const hour = new Date().getHours();
  const timeBucket =
    hour < 6 ? "noite" : hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";

  const templates: Record<string, string[]> = {
    manhã: [
      `Bom dia ${firstName}, como posso te ajudar?`,
      `Opa ${firstName}, bom dia. O que você precisa?`,
      `Oi ${firstName}, no que posso te ajudar hoje?`,
    ],
    tarde: [
      `Boa tarde ${firstName}, como posso te ajudar?`,
      `E aí ${firstName}, o que precisa?`,
      `Opa ${firstName}, tô aqui. O que você quer fazer?`,
    ],
    noite: [
      `Boa noite ${firstName}, como posso te ajudar?`,
      `Oi ${firstName}, ainda na ativa? O que precisa?`,
      `${firstName}, tô aqui. Manda ver.`,
    ],
  };
  const pool = templates[timeBucket]!;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
