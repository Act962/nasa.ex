"use client";

import { ChevronLeft, ChevronRight, MousePointerClick, X } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { TOUR_ACCENT, type HoleRect } from "./spotlight";
import type { TourPosition, TourStep } from "./types";

export const BUBBLE_WIDTH = 320;
const BUBBLE_HEIGHT = 230;
const BUBBLE_BACKGROUND = "rgba(10,4,40,0.97)";

interface Placement {
  bubble: React.CSSProperties;
  side: TourPosition;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Lado efetivo do balão: troca para o oposto quando não cabe na tela. */
export function placeBubble(hole: HoleRect, preferred: TourPosition, gap: number): Placement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let side = preferred;
  if (side === "right" && hole.x + hole.width + gap + BUBBLE_WIDTH > viewportWidth) side = "left";
  if (side === "left" && hole.x - gap - BUBBLE_WIDTH < 0) side = "right";
  if (side === "bottom" && hole.y + hole.height + gap + BUBBLE_HEIGHT > viewportHeight) side = "top";
  if (side === "top" && hole.y - gap - BUBBLE_HEIGHT < 0) side = "bottom";

  const centerY = hole.y + hole.height / 2;
  const centerX = hole.x + hole.width / 2;
  const maxBubbleTop = viewportHeight - BUBBLE_HEIGHT - 8;
  const maxBubbleLeft = viewportWidth - BUBBLE_WIDTH - 8;

  if (side === "right" || side === "left") {
    const bubbleLeft = side === "right" ? hole.x + hole.width + gap : Math.max(8, hole.x - gap - BUBBLE_WIDTH);
    const bubbleTop = clamp(centerY - BUBBLE_HEIGHT / 2, 8, maxBubbleTop);
    return {
      side,
      bubble: { top: bubbleTop, left: clamp(bubbleLeft, 8, maxBubbleLeft) },
    };
  }

  const bubbleLeft = clamp(centerX - BUBBLE_WIDTH / 2, 8, maxBubbleLeft);
  const bubbleTop =
    side === "bottom" ? hole.y + hole.height + gap : Math.max(8, hole.y - gap - BUBBLE_HEIGHT);
  const clampedBubbleTop = clamp(bubbleTop, 8, maxBubbleTop);
  return {
    side,
    bubble: { top: clampedBubbleTop, left: bubbleLeft },
  };
}

interface TourBubbleProps {
  step: TourStep;
  stepIndex: number;
  total: number;
  placement: Placement;
  isInputFilled: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

// Botão do balão não pode tirar o foco do campo que o usuário está preenchendo.
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const secondaryButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "7px 14px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.7)",
  cursor: "pointer",
};

function primaryButtonStyle(isDisabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    background: `linear-gradient(135deg, ${TOUR_ACCENT}, #a855f7)`,
    border: "none",
    color: "#fff",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.45 : 1,
    boxShadow: `0 4px 16px ${TOUR_ACCENT}55`,
  };
}

function StepActions({ step, isFirst, isLast, isInputFilled, onNext, onPrev }: {
  step: TourStep;
  isFirst: boolean;
  isLast: boolean;
  isInputFilled: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  const hintStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#c4b5fd",
  };

  const backButton = !isFirst && (
    <button onMouseDown={keepFocus} onClick={onPrev} style={secondaryButtonStyle} className="hover:!bg-white/15 transition-all">
      <ChevronLeft style={{ width: 14, height: 14 }} /> Voltar
    </button>
  );

  if (step.advanceOn === "click") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {backButton}
        <span style={hintStyle}>
          <MousePointerClick style={{ width: 14, height: 14 }} /> Clique no item destacado
        </span>
      </div>
    );
  }

  if (step.advanceOn === "result") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {backButton}
        <span style={hintStyle}>
          <OrbitaSpinner className="" style={{ width: 14, height: 14 }} /> Esperando você concluir…
        </span>
      </div>
    );
  }

  const isInputStep = step.advanceOn === "input";
  const isDisabled = isInputStep && !isInputFilled;
  const label = isInputStep ? "Continuar" : isLast ? "🚀 Concluir!" : "Próximo";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {backButton}
      <button
        onMouseDown={keepFocus}
        onClick={() => !isDisabled && onNext()}
        disabled={isDisabled}
        style={primaryButtonStyle(isDisabled)}
        className="hover:brightness-110 transition-all"
      >
        {label} {!isLast && <ChevronRight style={{ width: 14, height: 14 }} />}
      </button>
    </div>
  );
}

export function TourBubble({ step, stepIndex, total, placement, isInputFilled, onNext, onPrev, onSkip }: TourBubbleProps) {
  return (
    <>
      <div
        key={step.id}
        style={{
          position: "fixed",
          zIndex: 10001,
          width: BUBBLE_WIDTH,
          ...placement.bubble,
          pointerEvents: "auto",
          animation: "tourBubbleIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
      >
        <div
          style={{
            background: BUBBLE_BACKGROUND,
            border: `1.5px solid ${TOUR_ACCENT}66`,
            borderRadius: 18,
            padding: "18px 20px 16px",
            boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${TOUR_ACCENT}22`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: total }, (_, index) => (
                <div
                  key={index}
                  style={{
                    width: index === stepIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    background:
                      index === stepIndex
                        ? TOUR_ACCENT
                        : index < stepIndex
                          ? `${TOUR_ACCENT}80`
                          : "rgba(255,255,255,0.12)",
                    transition: "all 0.3s",
                  }}
                />
              ))}
            </div>
            <button
              onMouseDown={keepFocus}
              onClick={onSkip}
              style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
              className="hover:!text-white/70 transition-colors flex items-center gap-1"
            >
              <X style={{ width: 12, height: 12 }} /> Pular
            </button>
          </div>

          <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6, lineHeight: 1.3 }}>{step.title}</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", lineHeight: 1.6, marginBottom: 14 }}>{step.message}</p>

          <StepActions
            step={step}
            isFirst={stepIndex === 0}
            isLast={stepIndex === total - 1}
            isInputFilled={isInputFilled}
            onNext={onNext}
            onPrev={onPrev}
          />
        </div>
      </div>
    </>
  );
}
