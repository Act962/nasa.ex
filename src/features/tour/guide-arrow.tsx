"use client";

import { TOUR_ACCENT, type HoleRect } from "./spotlight";
import type { TourPosition } from "./types";

const ARROW_SIZE = 40;
const ARROW_OFFSET = 8;

// Gira o desenho (que aponta para a direita) para apontar do balão ao alvo.
const ROTATION_BY_SIDE: Record<TourPosition, number> = {
  right: 180,
  left: 0,
  bottom: 270,
  top: 90,
};

/** Seta que balança na direção do alvo, entre o furo e o balão. */
export function GuideArrow({ hole, bubbleSide }: { hole: HoleRect; bubbleSide: TourPosition }) {
  const centerX = hole.x + hole.width / 2 - ARROW_SIZE / 2;
  const centerY = hole.y + hole.height / 2 - ARROW_SIZE / 2;
  const clampTop = (value: number) => Math.min(window.innerHeight - ARROW_SIZE, Math.max(0, value));
  const clampLeft = (value: number) => Math.min(window.innerWidth - ARROW_SIZE, Math.max(0, value));

  const placement: Record<TourPosition, React.CSSProperties> = {
    right: { left: clampLeft(hole.x + hole.width + ARROW_OFFSET), top: clampTop(centerY) },
    left: { left: clampLeft(hole.x - ARROW_SIZE - ARROW_OFFSET), top: clampTop(centerY) },
    bottom: { left: clampLeft(centerX), top: clampTop(hole.y + hole.height + ARROW_OFFSET) },
    top: { left: clampLeft(centerX), top: clampTop(hole.y - ARROW_SIZE - ARROW_OFFSET) },
  };

  return (
    <div
      style={{
        position: "fixed",
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        pointerEvents: "none",
        zIndex: 10003,
        ...placement[bubbleSide],
      }}
    >
      <div style={{ width: "100%", height: "100%", transform: `rotate(${ROTATION_BY_SIDE[bubbleSide]}deg)` }}>
        <svg
          viewBox="0 0 24 24"
          width={ARROW_SIZE}
          height={ARROW_SIZE}
          style={{ animation: "guideArrowNudge 1s ease-in-out infinite", filter: `drop-shadow(0 0 8px ${TOUR_ACCENT})` }}
        >
          <path
            d="M3 12h14m0 0-6-6m6 6-6 6"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 12h14m0 0-6-6m6 6-6 6"
            fill="none"
            stroke={TOUR_ACCENT}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
