"use client";

export const TOUR_ACCENT = "#7c3aed";

export interface HoleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Recorta o destaque na janela: alvo maior que a tela (o board) não empurra o balão para fora. */
export function toHoleRect(rect: DOMRect, padding: number): HoleRect {
  const left = Math.max(0, rect.left - padding);
  const top = Math.max(0, rect.top - padding);
  const right = Math.min(window.innerWidth, rect.right + padding);
  const bottom = Math.min(window.innerHeight, rect.bottom + padding);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function Spotlight({ hole, pulse }: { hole: HoleRect; pulse?: boolean }) {
  const radius = 12;
  return (
    <svg
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="nasa-tour-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={radius} fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#nasa-tour-mask)" />
      <rect
        x={hole.x}
        y={hole.y}
        width={hole.width}
        height={hole.height}
        rx={radius}
        fill="none"
        stroke={TOUR_ACCENT}
        strokeWidth="2.5"
        opacity="0.9"
      />
      {pulse && (
        <>
          <rect
            x={hole.x - 4}
            y={hole.y - 4}
            width={hole.width + 8}
            height={hole.height + 8}
            rx={radius + 4}
            fill="none"
            stroke={TOUR_ACCENT}
            strokeWidth="1.5"
            style={{ animation: "tourPulse 2s ease-out infinite", transformOrigin: "center", transformBox: "fill-box" }}
            opacity="0.5"
          />
          <rect
            x={hole.x - 9}
            y={hole.y - 9}
            width={hole.width + 18}
            height={hole.height + 18}
            rx={radius + 9}
            fill="none"
            stroke={TOUR_ACCENT}
            strokeWidth="1"
            style={{ animation: "tourPulse 2s ease-out infinite 0.4s", transformOrigin: "center", transformBox: "fill-box" }}
            opacity="0.3"
          />
        </>
      )}
    </svg>
  );
}

/**
 * Quatro faixas em volta do furo: bloqueiam o resto da tela e deixam o alvo
 * clicável e editável (spec 0046, RF-4).
 */
export function HoleBlockers({ hole, onBackdropClick }: { hole: HoleRect; onBackdropClick?: () => void }) {
  const blockerStyle: React.CSSProperties = { position: "fixed", pointerEvents: "auto", cursor: "default" };
  const holeBottom = hole.y + hole.height;
  const holeRight = hole.x + hole.width;
  return (
    <>
      <div style={{ ...blockerStyle, left: 0, top: 0, width: "100%", height: hole.y }} onClick={onBackdropClick} />
      <div style={{ ...blockerStyle, left: 0, top: holeBottom, width: "100%", bottom: 0 }} onClick={onBackdropClick} />
      <div style={{ ...blockerStyle, left: 0, top: hole.y, width: hole.x, height: hole.height }} onClick={onBackdropClick} />
      <div style={{ ...blockerStyle, left: holeRight, top: hole.y, right: 0, height: hole.height }} onClick={onBackdropClick} />
    </>
  );
}
