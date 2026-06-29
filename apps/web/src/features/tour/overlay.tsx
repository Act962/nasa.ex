"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTour, type TourStep } from "./context";

// ── Element tracking hook ──────────────────────────────────────────────────────
function useTargetRect(selector: string, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    if (!active) { setRect(null); return; }

    const update = () => {
      const el = document.querySelector(selector);
      if (el) setRect(el.getBoundingClientRect());
      else    setRect(null);
    };

    // Retry until element appears (async renders)
    let attempts = 0;
    const tryFind = () => {
      update();
      attempts++;
      if (!document.querySelector(selector) && attempts < 20) {
        setTimeout(tryFind, 100);
      }
    };
    tryFind();

    const onAny = () => { rafRef.current = requestAnimationFrame(update); };
    window.addEventListener("scroll",  onAny, true);
    window.addEventListener("resize",  onAny);
    window.addEventListener("click",   onAny, true);

    return () => {
      window.removeEventListener("scroll",  onAny, true);
      window.removeEventListener("resize",  onAny);
      window.removeEventListener("click",   onAny, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [selector, active]);

  return rect;
}

// ── Spotlight (SVG with mask) ─────────────────────────────────────────────────
function Spotlight({ rect, pad, accentColor, pulse }: {
  rect: DOMRect; pad: number; accentColor: string; pulse?: boolean;
}) {
  const x = rect.left - pad;
  const y = rect.top  - pad;
  const w = rect.width  + pad * 2;
  const h = rect.height + pad * 2;
  const r = 12; // border-radius

  return (
    <svg
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="nasa-tour-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} fill="black" />
        </mask>
      </defs>

      {/* Dark overlay with hole */}
      <rect
        x="0" y="0" width="100%" height="100%"
        fill="rgba(0,0,0,0.78)"
        mask="url(#nasa-tour-mask)"
      />

      {/* Glow ring */}
      <rect
        x={x} y={y} width={w} height={h} rx={r}
        fill="none"
        stroke={accentColor}
        strokeWidth="2.5"
        opacity="0.9"
      />

      {/* Pulse rings */}
      {pulse && (
        <>
          <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={r + 4}
            fill="none" stroke={accentColor} strokeWidth="1.5"
            style={{ animation: "tourPulse 2s ease-out infinite" }} opacity="0.5"
          />
          <rect x={x - 9} y={y - 9} width={w + 18} height={h + 18} rx={r + 9}
            fill="none" stroke={accentColor} strokeWidth="1"
            style={{ animation: "tourPulse 2s ease-out infinite 0.4s" }} opacity="0.3"
          />
        </>
      )}
    </svg>
  );
}

// ── Astro bubble position calculator ──────────────────────────────────────────
interface BubbleStyle { top?: number; bottom?: number; left?: number; right?: number }
interface AstroStyle  { top?: number; bottom?: number; left?: number; right?: number; transform?: string }

function calcPositions(
  rect: DOMRect, pad: number, pos: TourStep["position"],
  bubbleW = 320, bubbleH = 220, astroSize = 96,
): { bubble: BubbleStyle; astro: AstroStyle; arrowSide: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 20;

  const hl = { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 };

  // Effective position (fallback if not enough space)
  let effectivePos = pos;
  if (pos === "right"  && hl.x + hl.w + gap + bubbleW > vw) effectivePos = "left";
  if (pos === "left"   && hl.x - gap - bubbleW < 0)          effectivePos = "right";
  if (pos === "bottom" && hl.y + hl.h + gap + bubbleH > vh)  effectivePos = "top";
  if (pos === "top"    && hl.y - gap - bubbleH < 0)           effectivePos = "bottom";

  let bubble: BubbleStyle = {};
  let astro:  AstroStyle  = {};
  let arrowSide = "left";

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  if (effectivePos === "right") {
    bubble = { top: clamp(hl.y + hl.h / 2 - bubbleH / 2, 8, vh - bubbleH - 8), left: hl.x + hl.w + gap };
    astro  = { top: clamp(hl.y + hl.h / 2 - astroSize / 2 - 20, 8, vh - astroSize - 8), left: hl.x + hl.w + gap - astroSize * 0.6 };
    arrowSide = "left";
  } else if (effectivePos === "left") {
    bubble = { top: clamp(hl.y + hl.h / 2 - bubbleH / 2, 8, vh - bubbleH - 8), left: Math.max(8, hl.x - gap - bubbleW) };
    astro  = { top: clamp(hl.y + hl.h / 2 - astroSize / 2 - 20, 8, vh - astroSize - 8), left: Math.max(8, hl.x - gap - bubbleW + bubbleW * 0.7) };
    arrowSide = "right";
  } else if (effectivePos === "bottom") {
    bubble = { top: hl.y + hl.h + gap, left: clamp(hl.x + hl.w / 2 - bubbleW / 2, 8, vw - bubbleW - 8) };
    astro  = { top: hl.y + hl.h + gap - astroSize * 0.55, left: clamp(hl.x + hl.w / 2 + bubbleW / 2 - astroSize - 4, 8, vw - astroSize - 8) };
    arrowSide = "top";
  } else { // top
    bubble = { top: Math.max(8, hl.y - gap - bubbleH), left: clamp(hl.x + hl.w / 2 - bubbleW / 2, 8, vw - bubbleW - 8) };
    astro  = { top: Math.max(8, hl.y - gap - bubbleH + bubbleH * 0.55), left: clamp(hl.x + hl.w / 2 + bubbleW / 2 - astroSize - 4, 8, vw - astroSize - 8) };
    arrowSide = "bottom";
  }

  return { bubble, astro, arrowSide };
}

// ── Astro Speech Bubble ───────────────────────────────────────────────────────
function AstroBubble({ step, stepIndex, total, rect, pad, onNext, onPrev, onSkip }: {
  step:       TourStep;
  stepIndex:  number;
  total:      number;
  rect:       DOMRect;
  pad:        number;
  onNext:     () => void;
  onPrev:     () => void;
  onSkip:     () => void;
}) {
  const BUBBLE_W  = 320;
  const BUBBLE_H  = 230;
  const ASTRO_SZ  = 100;
  const ACCENT    = "#7c3aed";
  const isFirst   = stepIndex === 0;
  const isLast    = stepIndex === total - 1;

  const { bubble, astro, arrowSide } = calcPositions(rect, pad, step.position, BUBBLE_W, BUBBLE_H, ASTRO_SZ);

  const arrowStyles: Record<string, React.CSSProperties> = {
    left:   { position: "absolute", left:  -10, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderRight: `10px solid rgba(17,5,50,0.98)` },
    right:  { position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: `10px solid rgba(17,5,50,0.98)` },
    top:    { position: "absolute", top:   -10, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderBottom: `10px solid rgba(17,5,50,0.98)` },
    bottom: { position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: `10px solid rgba(17,5,50,0.98)` },
  };

  return (
    <>
      {/* Astro mascot */}
      <div
        style={{
          position: "fixed", zIndex: 10002, width: ASTRO_SZ, height: ASTRO_SZ,
          ...astro,
          animation: "astroTourBob 2.5s ease-in-out infinite",
          filter: `drop-shadow(0 0 18px ${ACCENT}99)`,
          pointerEvents: "none",
        }}
      >
        <Image src="/icon-astro.svg" alt="ASTRO" fill className="object-contain" unoptimized />
      </div>

      {/* Speech bubble */}
      <div
        style={{
          position: "fixed",
          zIndex: 10001,
          width: BUBBLE_W,
          ...bubble,
          animation: "tourBubbleIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
      >
        {/* Arrow */}
        <div style={arrowStyles[arrowSide]} />

        {/* Card */}
        <div
          style={{
            background: "rgba(10,4,40,0.97)",
            border: `1.5px solid ${ACCENT}66`,
            borderRadius: 18,
            padding: "18px 20px 16px",
            boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${ACCENT}22`,
          }}
        >
          {/* Header: step counter + skip */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: total }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === stepIndex ? 20 : 6, height: 6, borderRadius: 3,
                    background: i === stepIndex ? ACCENT : i < stepIndex ? `${ACCENT}80` : "rgba(255,255,255,0.12)",
                    transition: "all 0.3s",
                  }}
                />
              ))}
            </div>
            <button
              onClick={onSkip}
              style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
              className="hover:!text-white/70 transition-colors flex items-center gap-1"
            >
              <X style={{ width: 12, height: 12 }} /> Pular
            </button>
          </div>

          {/* Title */}
          <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6, lineHeight: 1.3 }}>
            {step.title}
          </p>

          {/* Message */}
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", lineHeight: 1.6, marginBottom: 14 }}>
            {step.message}
          </p>

          {/* Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isFirst && (
              <button
                onClick={onPrev}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.7)", cursor: "pointer",
                }}
                className="hover:!bg-white/15 transition-all"
              >
                <ChevronLeft style={{ width: 14, height: 14 }} /> Voltar
              </button>
            )}
            <button
              onClick={onNext}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
                border: "none", color: "#fff", cursor: "pointer",
                boxShadow: `0 4px 16px ${ACCENT}55`,
              }}
              className="hover:brightness-110 transition-all"
            >
              {isLast ? "🚀 Concluir!" : (<>Próximo <ChevronRight style={{ width: 14, height: 14 }} /></>)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main TourOverlay ───────────────────────────────────────────────────────────
export function TourOverlay() {
  const { isActive, stepIndex, steps, nextStep, prevStep, endTour } = useTour();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const currentStep = steps[stepIndex];
  const pad = currentStep?.padding ?? 10;
  const rect = useTargetRect(currentStep?.selector ?? "", isActive);

  if (!mounted || !isActive || !currentStep || !rect) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes tourPulse {
          0%   { opacity: 0.7; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.15); }
        }
        @keyframes astroTourBob {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50%       { transform: translateY(-12px) rotate(4deg); }
        }
        @keyframes tourBubbleIn {
          from { opacity: 0; transform: scale(0.88) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      {/* Clickable backdrop (click outside = skip) */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998, cursor: "default" }}
        onClick={(e) => { if (e.target === e.currentTarget) endTour(); }}
      />

      {/* SVG Spotlight */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
        <Spotlight rect={rect} pad={pad} accentColor="#7c3aed" pulse={currentStep.pulse} />
      </div>

      {/* Astro + bubble */}
      <div style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <AstroBubble
            step={currentStep}
            stepIndex={stepIndex}
            total={steps.length}
            rect={rect}
            pad={pad}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={endTour}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
