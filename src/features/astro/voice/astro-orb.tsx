"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Mic, Sparkles, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { useAstroOrbStore } from "./use-astro-orb-store";
import { useAstroWidgetStore } from "./use-astro-widget-store";
import { useAstroPendingApprovals } from "@/features/astro-commander/hooks/use-astro-pending-approvals";
import { useAstroPulse } from "@/features/astro/hooks/use-astro-pulse";
import { useAstroBalloonTour } from "@/features/astro/hooks/use-astro-balloon-tour";
import { useNotifications } from "@/components/sidebar/hooks/use-notifications";
import { AstroSpeechFeed } from "./astro-speech-feed";
import { useOrbCenter, useOrbDrag } from "@/features/astro/hooks/use-orb-position";
import { ORB_SIZE_PX, orbSides } from "@/features/astro/lib/orb-layout";
import { useVoiceModeStore } from "./use-voice-mode-store";
import { useWakeWord } from "./use-wake-word";
import { unlockAudio } from "./tts";
import { useAstroVoiceActions } from "./use-astro-voice-actions";
import { AstroVoiceMenuItems } from "./astro-voice-menu";
import { MicPermissionGuide } from "./mic-permission-guide";
import { ORB_KEYFRAMES, ORB_PHASES } from "./orb-visuals";

/**
 * AstroOrb — o "pet" flutuante do Astro, montado globalmente no platform-providers.
 *
 * - Parado, fora do /home: o clique abre e fecha o painel de chat (spec 0015).
 * - No /home, onde o chat ocupa a página: o clique abre o menu de voz.
 * - Ouvindo, pensando ou falando: o clique cancela.
 * - Com a wake word ligada, escuta "ASTRO" continuamente. O loop mora só aqui.
 *
 * Privacy: indicador visual permanente quando a wake word está ligada.
 * A escuta pausa enquanto o TTS fala, pra não pegar a própria voz do Astro.
 */
export function AstroOrb() {
  useAstroPulse();
  const visible = useAstroOrbStore((state) => state.visible);
  const phase = useAstroOrbStore((state) => state.phase);
  const wakeWordEnabled = useAstroOrbStore((state) => state.wakeWordEnabled);
  const hint = useAstroOrbStore((state) => state.hint);
  const micGuideOpen = useAstroOrbStore((state) => state.micGuideOpen);
  const setPhase = useAstroOrbStore((state) => state.setPhase);
  const setHint = useAstroOrbStore((state) => state.setHint);
  const setWakeWordEnabled = useAstroOrbStore((state) => state.setWakeWordEnabled);
  const setVisible = useAstroOrbStore((state) => state.setVisible);
  const setMicGuideOpen = useAstroOrbStore((state) => state.setMicGuideOpen);

  const isWidgetOpen = useAstroWidgetStore((state) => state.isOpen);
  const unreadCount = useAstroWidgetStore((state) => state.unreadCount);
  // Aprovação parada é execução automática parada: entra no mesmo contador das
  // respostas novas, para o usuário saber sem precisar abrir o app.
  const { pendingCount: pendingApprovals, isLoading: isLoadingApprovals } =
    useAstroPendingApprovals();
  const {
    unread: unreadAlerts,
    notifications,
    isLoading: isLoadingAlerts,
  } = useNotifications();
  const hasUnreadAlerts = unreadAlerts > 0;
  const toggleWidget = useAstroWidgetStore((state) => state.toggle);
  const closeWidget = useAstroWidgetStore((state) => state.close);

  // O disco inteiro é o "corpo" da marca: é ele que treme e aquece na zanga.
  const discoRef = useRef<HTMLButtonElement>(null);

  const isSpeaking = useVoiceModeStore((state) => state.isSpeaking);
  const pathname = usePathname();
  const isOnHome = pathname === "/home";

  // Orb arrastável: posição salva por usuário, balão e menu abrem para dentro da tela.
  const { center, viewport, isMeasured } = useOrbCenter();
  const { opensUpward, alignsRight } = orbSides(center, viewport);
  const orbDrag = useOrbDrag(center, viewport);

  // Ao chegar na página, o ASTRO fala o que está pendente, como no site.
  useAstroBalloonTour({
    pathname,
    isReady: !isOnHome && !isLoadingApprovals && !isLoadingAlerts,
    alerts: notifications,
    pendingApprovals,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const { captureUtterance } = useAstroVoiceActions();

  // O menu só existe no /home; trocar de tela fecha.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Sync TTS speaking → phase visual
  useEffect(() => {
    if (isSpeaking && phase !== "speaking") {
      setPhase("speaking");
    } else if (!isSpeaking && phase === "speaking") {
      setPhase("idle");
    }
  }, [isSpeaking, phase, setPhase]);

  // Wake word loop — quando dispara, Astro saúda antes de escutar
  useWakeWord({
    enabled: wakeWordEnabled && phase === "idle",
    paused: isSpeaking, // não pega a própria voz do TTS
    onWake: () => {
      captureUtterance({ withGreeting: true });
    },
    onError: (wakeWordError) => {
      // Erro de permissão → desliga wake word + abre o guia acionável
      if (wakeWordError === "not-allowed" || wakeWordError === "service-not-allowed") {
        setWakeWordEnabled(false);
        setMicGuideOpen(true);
      }
    },
  });

  // Escondido: sobra um alvo mínimo pra trazer o Astro de volta. Sem ele,
  // fechar o orb era irreversível — `visible` é persistido em localStorage e
  // nenhuma outra tela reativa.
  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        title="Mostrar o Astro"
        aria-label="Mostrar o Astro"
        className="fixed bottom-3 right-3 z-[9000] size-6 rounded-full border border-violet-500/30 bg-zinc-900/60 text-violet-300/70 opacity-40 shadow transition hover:opacity-100 flex items-center justify-center"
      >
        <Sparkles className="size-3" />
      </button>
    );
  }

  const handleOrbClick = () => {
    // iOS Safari: aproveita esse gesto pra destravar audio/speechSynth.
    // Sem isso, primeiro speak() depois fica mudo no iPhone.
    unlockAudio();
    if (phase !== "idle") {
      setPhase("idle");
      setHint(null);
      return;
    }
    if (isOnHome) {
      setMenuOpen((isMenuOpen) => !isMenuOpen);
      return;
    }
    // Abrindo com algo esperando o usuário: começa em Início (spec 0029, CA-6).
    if (!isWidgetOpen && (pendingApprovals > 0 || hasUnreadAlerts)) {
      useAstroWidgetStore.getState().setView("home");
    }
    toggleWidget();
  };

  const phaseStyle = ORB_PHASES[phase];
  // Com o painel aberto, o estado da voz aparece no próprio campo de mensagem.
  const badgeCount = unreadCount + pendingApprovals;
  const hasUnread = badgeCount > 0 && !isWidgetOpen;

  const orbTitle =
    phase === "listening"
      ? "Cancelar captura"
      : phase === "thinking"
        ? "Astro processando"
        : phase === "speaking"
          ? "Astro falando"
          : isOnHome
            ? wakeWordEnabled
              ? "Escutando 'ASTRO' — clique pro menu"
              : "Astro — clique pro menu de voz"
            : isWidgetOpen
              ? "Fechar o chat do Astro"
              : "Conversar com o Astro";

  return (
    <div
      className={cn(
        "fixed z-[9000] size-12 pointer-events-none",
        // Antes de medir a tela, o canto de sempre: servidor e cliente desenham igual.
        !isMeasured && "bottom-5 right-5",
      )}
      style={
        isMeasured
          ? { left: center.x - ORB_SIZE_PX / 2, top: center.y - ORB_SIZE_PX / 2 }
          : undefined
      }
    >
      {/* Balão e menu abrem para dentro da tela, a partir de onde o orb está. */}
      <div
        className={cn(
          // Largura explícita: preso a um orb de 48px, o balão encolheria até ele.
          "absolute flex w-[min(280px,calc(100vw-2.5rem))] gap-2",
          opensUpward ? "bottom-full mb-2 flex-col" : "top-full mt-2 flex-col-reverse",
          alignsRight ? "right-0 items-end" : "left-0 items-start",
        )}
      >
        {/* Balão de fala: atividades e alertas do ASTRO (spec 0029, RF-10). */}
        {!isWidgetOpen && !orbDrag.isDragging && (
          <AstroSpeechFeed
            voiceHint={hint}
            pointsTo={`${opensUpward ? "bottom" : "top"}-${alignsRight ? "right" : "left"}`}
          />
        )}

        {/* Menu de voz (só no /home) */}
        {menuOpen && (
          <div
            className="pointer-events-auto rounded-xl bg-zinc-900/95 backdrop-blur border border-zinc-700/60 shadow-xl overflow-hidden"
            role="menu"
          >
            <AstroVoiceMenuItems onAction={() => setMenuOpen(false)} />
          </div>
        )}
      </div>

      {/* Keyframes locais — evita plugin do Tailwind */}
      <style>{ORB_KEYFRAMES}</style>

      {/* O orb propriamente, com o botão de fechar sobreposto no canto */}
      <div className="pointer-events-none relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setVisible(false);
            setMenuOpen(false);
            closeWidget();
          }}
          title="Fechar o Astro"
          aria-label="Fechar o Astro"
          className="pointer-events-auto absolute -left-1.5 -top-1.5 z-20 flex size-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 shadow-md transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="size-3" />
        </button>

        <button
          ref={discoRef}
          type="button"
          {...orbDrag.handlers}
          onClick={() => {
            // Soltar um arraste dispara `click`: não pode abrir o painel.
            if (orbDrag.shouldIgnoreClick()) return;
            handleOrbClick();
          }}
          title={orbTitle}
          aria-label={orbTitle}
          data-tour="astro-button"
          aria-expanded={isOnHome ? menuOpen : isWidgetOpen}
          className={cn(
            "pointer-events-auto relative size-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-500 hover:scale-105 active:scale-95 cursor-grab select-none",
            orbDrag.isDragging && "cursor-grabbing scale-110",
            phaseStyle.bg,
            phaseStyle.ring,
          )}
          style={{
            boxShadow: phaseStyle.glow,
            // Sem isso, arrastar com o dedo rola a página em vez de mover o orb.
            touchAction: "none",
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
            className={cn(
              "z-10 text-white",
              // Parado, o Astro é o próprio disco. Ouvindo, pensando ou
              // falando, o ícone de estado volta — ele diz o que está
              // acontecendo, e um rosto não diria.
              phase === "idle" ? "absolute inset-0 p-px" : "relative",
            )}
            style={{ animation: "orb-icon-in 0.35s ease-out" }}
          >
            {phase === "listening" ? (
              <Mic className="size-5" />
            ) : phase === "thinking" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : phase === "speaking" ? (
              <Volume2 className="size-5" />
            ) : (
              <AstroMark corpo={discoRef} />
            )}
          </span>

          {/* Resposta nova com o painel fechado tem prioridade sobre o indicador da escuta */}
          {hasUnread ? (
            <span
              className="absolute -top-1 -right-1 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-zinc-950 pointer-events-none"
              aria-label={
                pendingApprovals > 0
                  ? `${pendingApprovals} ação(ões) do Astro esperando aprovação`
                  : `${unreadCount} resposta(s) nova(s) do Astro`
              }
            >
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          ) : (
            wakeWordEnabled &&
            phase === "idle" && (
              <span
                className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-zinc-950 pointer-events-none"
                style={{ animation: "orb-breathe 3.6s ease-in-out infinite" }}
                aria-label="Escuta ativa"
              />
            )
          )}
        </button>
      </div>

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

      {/* Guia de permissão — aberto pelo menu, pelo painel ou pela wake word */}
      {micGuideOpen && <MicPermissionGuide onClose={() => setMicGuideOpen(false)} />}
    </div>
  );
}
