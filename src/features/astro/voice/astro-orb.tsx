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
  const [micGuideOpen, setMicGuideOpen] = useState(false);

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
      // Erro de permissão → desliga wake word + abre o guide acionável
      if (err === "not-allowed" || err === "service-not-allowed") {
        setWakeWordEnabled(false);
        setMicGuideOpen(true);
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

  const handleToggleWakeWord = async () => {
    // Desligar é sempre OK
    if (wakeWordEnabled) {
      setWakeWordEnabled(false);
      return;
    }

    // Pre-check via Permissions API (Chrome/Edge têm; Safari não)
    let permState: PermissionState | null = null;
    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({
          // 'microphone' é válido em browsers modernos mas o tipo padrão
          // do TS aceita ele desde lib.dom recente — cast pra evitar atrito
          // entre versões.
          name: "microphone" as PermissionName,
        });
        permState = status.state;
      }
    } catch {
      // ignora — fallback pra getUserMedia
    }

    // Se já está negado, não adianta tentar — abre o guide pra user corrigir manualmente
    if (permState === "denied") {
      setMicGuideOpen(true);
      return;
    }

    // Força o prompt do browser (ou usa permissão já granted)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Solta o stream imediatamente — só queríamos a permissão
      stream.getTracks().forEach((t) => t.stop());
      setWakeWordEnabled(true);
      setHint("Escuta ativada — diga 'ASTRO' pra eu te ouvir");
      setTimeout(() => setHint(null), 3500);
    } catch (err) {
      // NotAllowedError = user negou agora; SecurityError = contexto não-seguro
      console.warn("[astro-orb] mic permission failed:", err);
      setMicGuideOpen(true);
    }
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
      {/* Hint flutuante — pequeno balão acima do orb */}
      {hint && (
        <div
          className="pointer-events-auto relative rounded-2xl px-3 py-1.5 text-xs text-zinc-100 shadow-xl max-w-xs animate-in fade-in slide-in-from-bottom-1 duration-200"
          style={{
            background:
              "linear-gradient(135deg, rgba(24,24,27,0.96) 0%, rgba(39,39,42,0.96) 100%)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(124,58,237,0.25)",
            boxShadow:
              "0 8px 24px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
          aria-live="polite"
        >
          {hint}
          {/* Tail apontando pro orb */}
          <span
            className="absolute -bottom-1 right-6 size-2 rotate-45"
            style={{
              background: "rgba(39,39,42,0.96)",
              borderRight: "1px solid rgba(124,58,237,0.25)",
              borderBottom: "1px solid rgba(124,58,237,0.25)",
            }}
            aria-hidden
          />
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

      {/* Keyframes locais — evita plugin do Tailwind */}
      <style>{ORB_KEYFRAMES}</style>

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
          "pointer-events-auto relative size-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-500 hover:scale-105 active:scale-95",
          phaseStyle.bg,
          phaseStyle.ring,
        )}
        style={{
          boxShadow: phaseStyle.glow,
        }}
      >
        {/* ── LISTENING: 3 ondas concêntricas em delay ──────────────── */}
        {phase === "listening" && (
          <>
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0) 70%)",
                animation: "orb-ripple 1.6s ease-out infinite",
              }}
              aria-hidden
            />
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 70%)",
                animation: "orb-ripple 1.6s ease-out infinite",
                animationDelay: "0.53s",
              }}
              aria-hidden
            />
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0) 70%)",
                animation: "orb-ripple 1.6s ease-out infinite",
                animationDelay: "1.06s",
              }}
              aria-hidden
            />
          </>
        )}

        {/* ── SPEAKING: aurora gradiente rotacionando ───────────────── */}
        {phase === "speaking" && (
          <span
            className="absolute -inset-2 rounded-full pointer-events-none"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(16,185,129,0.6), rgba(59,130,246,0.6), rgba(168,85,247,0.6), rgba(16,185,129,0.6))",
              filter: "blur(8px)",
              animation: "orb-aurora 4s linear infinite",
            }}
            aria-hidden
          />
        )}

        {/* ── IDLE + wake ON: halo respirando + ring sutil ──────────── */}
        {wakeWordEnabled && phase === "idle" && (
          <>
            <span
              className="absolute -inset-1 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(16,185,129,0) 70%)",
                animation: "orb-breathe 3.6s ease-in-out infinite",
              }}
              aria-hidden
            />
            {/* 3 partículas esparsas orbitando */}
            <span
              className="absolute size-1 rounded-full bg-emerald-300 pointer-events-none"
              style={{
                top: "50%",
                left: "50%",
                animation: "orb-orbit 6s linear infinite",
                animationDelay: "0s",
              }}
              aria-hidden
            />
            <span
              className="absolute size-1 rounded-full bg-violet-300 pointer-events-none"
              style={{
                top: "50%",
                left: "50%",
                animation: "orb-orbit 6s linear infinite",
                animationDelay: "2s",
                opacity: 0.7,
              }}
              aria-hidden
            />
            <span
              className="absolute size-0.5 rounded-full bg-blue-300 pointer-events-none"
              style={{
                top: "50%",
                left: "50%",
                animation: "orb-orbit 6s linear infinite",
                animationDelay: "4s",
                opacity: 0.6,
              }}
              aria-hidden
            />
          </>
        )}

        {/* Icone central — cross-fade entre phases */}
        <span
          key={phase}
          className="relative z-10 text-white"
          style={{ animation: "orb-icon-in 0.35s ease-out" }}
        >
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
            className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-zinc-950 pointer-events-none"
            style={{ animation: "orb-breathe 3.6s ease-in-out infinite" }}
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

      {/* Mic Permission Guide — modal acionável quando perm está NEGADA */}
      {micGuideOpen && (
        <MicPermissionGuide onClose={() => setMicGuideOpen(false)} />
      )}
    </div>
  );
}

/**
 * Modal acionável quando o microfone está negado pra essa origem.
 * Browser não nos deixa "resetar" via JS (regra de segurança), mas
 * podemos mostrar passos claros + deep-link pras configurações do Chrome.
 */
function MicPermissionGuide({ onClose }: { onClose: () => void }) {
  const isChromium =
    typeof navigator !== "undefined" &&
    /chrome|edge|chromium/i.test(navigator.userAgent) &&
    !/safari\/.*version/i.test(navigator.userAgent.toLowerCase());
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[9100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-200"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <h3 className="text-base font-semibold text-zinc-100">
          Preciso de permissão de microfone
        </h3>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          O Astro precisa ouvir você pra atender quando disser
          <span className="text-violet-300 font-mono"> "ASTRO"</span>. O
          microfone foi bloqueado pra esse site no seu browser e eu não
          consigo resetar por motivo de segurança — você precisa liberar
          manualmente. É rápido.
        </p>

        <ol className="mt-4 space-y-2 text-sm text-zinc-300">
          <li className="flex gap-2">
            <span className="shrink-0 size-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">
              1
            </span>
            <span>
              Click no ícone do <strong>cadeado 🔒</strong> (ou
              "Não seguro") do lado esquerdo da URL <code className="text-violet-300 font-mono text-xs">{origin}</code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 size-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">
              2
            </span>
            <span>
              Encontre <strong>"Microfone"</strong> e mude pra{" "}
              <span className="text-emerald-300">Permitir</span>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 size-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">
              3
            </span>
            <span>
              Recarregue a página (<kbd className="px-1 py-0.5 rounded bg-zinc-800 text-[10px]">⌘R</kbd>) e tente ativar a escuta de novo
            </span>
          </li>
        </ol>

        {isChromium && (
          <p className="mt-4 text-xs text-zinc-500">
            Atalho Chrome/Edge: cole na barra de endereço{" "}
            <code className="text-violet-300 font-mono text-xs">
              chrome://settings/content/microphone
            </code>{" "}
            e libere o site (não é clicável aqui por segurança).
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

const ORB_PHASES: Record<
  "idle" | "listening" | "thinking" | "speaking",
  { bg: string; ring: string; glow: string }
> = {
  idle: {
    bg: "bg-gradient-to-br from-violet-600 to-purple-700",
    ring: "ring-2 ring-violet-500/40",
    glow: "0 8px 32px -8px rgba(124,58,237,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
  },
  listening: {
    bg: "bg-gradient-to-br from-blue-500 to-blue-700",
    ring: "ring-2 ring-blue-400/40",
    glow: "0 10px 36px -6px rgba(59,130,246,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
  },
  thinking: {
    bg: "bg-gradient-to-br from-purple-500 to-fuchsia-700",
    ring: "ring-2 ring-fuchsia-400/40",
    glow: "0 10px 36px -6px rgba(217,70,239,0.65), 0 0 0 1px rgba(255,255,255,0.06)",
  },
  speaking: {
    bg: "bg-gradient-to-br from-emerald-500 to-teal-700",
    ring: "ring-2 ring-emerald-400/40",
    glow: "0 12px 40px -4px rgba(16,185,129,0.75), 0 0 0 1px rgba(255,255,255,0.1)",
  },
};

/**
 * Keyframes do orb. Tudo respeita `prefers-reduced-motion: reduce`
 * (animações são desabilitadas via media query).
 */
const ORB_KEYFRAMES = `
  @keyframes orb-ripple {
    0%   { transform: scale(0.8); opacity: 0.9; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes orb-aurora {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes orb-breathe {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50%      { opacity: 1;   transform: scale(1.06); }
  }
  /* Órbita dos sparkles — cada um nasce no centro, vai pra borda e some.
     Combinação de translate + scale + opacity pra criar "respiração de luz". */
  @keyframes orb-orbit {
    0% {
      transform: translate(-50%, -50%) rotate(0deg) translateX(0px) scale(0);
      opacity: 0;
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(72deg) translateX(20px) scale(1);
    }
    80% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(288deg) translateX(28px) scale(1);
    }
    100% {
      transform: translate(-50%, -50%) rotate(360deg) translateX(0px) scale(0);
      opacity: 0;
    }
  }
  @keyframes orb-icon-in {
    0%   { transform: scale(0.6) rotate(-12deg); opacity: 0; }
    60%  { transform: scale(1.12) rotate(4deg);  opacity: 1; }
    100% { transform: scale(1) rotate(0deg);     opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    /* Mantém apenas indicação estática — sem motion */
  }
`;

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
