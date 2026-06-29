"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CriticalAlertPayload {
  id: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  /** Quando true, bloqueia ESC + backdrop click; só fecha pelo botão. */
  requiresAck: boolean;
}

interface Props {
  payload: CriticalAlertPayload | null;
  onAcknowledge: (id: string) => void | Promise<void>;
}

/**
 * Popup full-screen pra alertas críticos.
 *
 * Independente do AchievementPopup (gamification) — separação intencional
 * pra que mudanças visuais no level-up não vazem em alertas de produção.
 *
 * Comportamento:
 *  - Renderiza via Portal em document.body (z-index 10001).
 *  - Quando requiresAck=true: ESC, backdrop click e foco-fora não fecham.
 *    Só o botão "Entendi" chama onAcknowledge.
 *  - Som grave (440 Hz, 3 pulsos) tocado uma vez no mount.
 *  - prefers-reduced-motion respeitado.
 */
export function AlertCriticalPopup({ payload, onAcknowledge }: Props) {
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [acking, setAcking] = useState(false);
  const soundPlayedRef = useRef(false);

  useEffect(() => {
    if (!payload) {
      setMounted(false);
      setExiting(false);
      soundPlayedRef.current = false;
      return;
    }
    setMounted(true);
    setExiting(false);

    if (!soundPlayedRef.current) {
      soundPlayedRef.current = true;
      playCriticalTone();
    }
  }, [payload]);

  // Bloqueia ESC se requiresAck
  useEffect(() => {
    if (!payload || !payload.requiresAck) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [payload]);

  // Bloqueia scroll do body enquanto popup está aberto
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!payload || !mounted) return null;

  const handleAck = async () => {
    if (acking) return;
    setAcking(true);
    setExiting(true);
    try {
      await onAcknowledge(payload.id);
    } finally {
      // espera animação terminar antes de desmontar
      setTimeout(() => {
        setMounted(false);
        setAcking(false);
      }, 320);
    }
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!payload.requiresAck) {
      void handleAck();
    }
    // Se requiresAck, ignora o clique no backdrop (visual jiggle abaixo).
  };

  const animClass = exiting ? "alert-popup-exit" : "alert-popup-enter";

  const content = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-popup-title"
      aria-describedby="alert-popup-body"
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001 }}
      onClick={handleBackdrop}
    >
      <style>{KEYFRAMES}</style>
      <div className="absolute inset-0 bg-red-950/70 backdrop-blur-sm" />

      <div
        className={cn(
          "relative z-10 pointer-events-auto rounded-2xl shadow-2xl",
          "max-w-md w-[92vw] overflow-hidden",
          animClass,
        )}
        style={{
          background:
            "linear-gradient(135deg, #7f1d1d 0%, #991b1b 55%, #b91c1c 100%)",
          color: "white",
          boxShadow:
            "0 25px 60px -20px rgba(239,68,68,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Linha de "alerta" superior animada */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-red-300 to-amber-400 alert-popup-pulse" />

        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 size-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <AlertTriangle className="size-7 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-red-200/80">
                Alerta crítico
              </p>
              <h2
                id="alert-popup-title"
                className="mt-1 text-xl font-bold leading-tight"
              >
                {payload.title}
              </h2>
            </div>
          </div>

          <p
            id="alert-popup-body"
            className="mt-5 text-sm leading-relaxed text-red-50/90 whitespace-pre-wrap"
          >
            {payload.body}
          </p>

          <div className="mt-6 flex items-center justify-end gap-2">
            {payload.actionUrl && (
              <a
                href={payload.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20 transition-colors"
              >
                Ver detalhes
                <ExternalLink className="size-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={handleAck}
              disabled={acking}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold",
                "bg-white text-red-900 hover:bg-red-50 active:scale-95 transition-all",
                "disabled:opacity-60 disabled:cursor-wait",
              )}
            >
              <X className="size-4" />
              {acking ? "Confirmando..." : "Entendi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

const KEYFRAMES = `
  @keyframes alert-pop-in {
    0%   { transform: scale(0.85) translateY(20px); opacity: 0; }
    70%  { transform: scale(1.02) translateY(-3px); opacity: 1; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes alert-pop-out {
    0%   { transform: scale(1) translateY(0); opacity: 1; }
    100% { transform: scale(0.9) translateY(10px); opacity: 0; }
  }
  @keyframes alert-pop-pulse {
    0%, 100% { opacity: 0.6; }
    50%      { opacity: 1; }
  }
  .alert-popup-enter { animation: alert-pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .alert-popup-exit  { animation: alert-pop-out 0.3s ease-in forwards; }
  .alert-popup-pulse { animation: alert-pop-pulse 1.8s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .alert-popup-enter, .alert-popup-exit, .alert-popup-pulse {
      animation: none;
    }
  }
`;

/**
 * Toca tom grave de alerta — 3 pulsos a 440 Hz com queda em volume.
 * Best-effort: AudioContext pode falhar (autoplay policy) — silencia.
 */
function playCriticalTone() {
  try {
    const win = window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = win.AudioContext ?? win.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const baseFreq = 440;
    [0, 0.18, 0.36].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = baseFreq;
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.16, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
  } catch {
    /* silently skip */
  }
}
