// Contorno tracejado dos quadros: o azul anda devagar, o vermelho fica parado, e os dois pulsam com o mouse em cima na visão "Visual" (spec 0090): azul quando o passo
// está certo; vermelho quando tem problema ou vem depois de um passo com problema (e por isso não
// roda se aquele falhar). Tons pastel, derivados dos tokens do tema, para destacar sem gritar.

export type OutlineTone = "ok" | "problem";

const TONE_COLOR: Record<OutlineTone, string> = {
  ok: "color-mix(in oklab, var(--info) 55%, white)",
  problem: "color-mix(in oklab, var(--destructive) 55%, white)",
};

export function outlineToneColor(tone: OutlineTone): string {
  return TONE_COLOR[tone];
}

const OUTLINE_WIDTH = 4;
export const DASH_LENGTH = 14;
export const DASH_GAP = 8;

export function AnimatedOutline({ tone, radius = 16 }: { tone: OutlineTone; radius?: number }) {
  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute -inset-1.5 size-[calc(100%+0.75rem)] overflow-visible"
      >
        <rect
          className={tone === "ok" ? "orbita-outline-rect orbita-outline-ok" : "orbita-outline-rect"}
          x={OUTLINE_WIDTH / 2}
          y={OUTLINE_WIDTH / 2}
          rx={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={OUTLINE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${DASH_LENGTH} ${DASH_GAP}`}
          // Largura e altura por CSS: o atributo do SVG não aceita `calc()`.
          style={{
            color: TONE_COLOR[tone],
            width: `calc(100% - ${OUTLINE_WIDTH}px)`,
            height: `calc(100% - ${OUTLINE_WIDTH}px)`,
          }}
        />
        <style>{`@keyframes orbita-outline-march { to { stroke-dashoffset: -${DASH_LENGTH + DASH_GAP}; } }
@keyframes orbita-outline-pulse { 0%, 100% { stroke-opacity: 1; } 50% { stroke-opacity: .5; } }
.orbita-outline-ok { animation: orbita-outline-march 1.1s linear infinite; }
.react-flow__node:hover .orbita-outline-rect { animation: orbita-outline-pulse 1.6s ease-in-out infinite !important; }
.react-flow__node:hover .orbita-outline-ok { animation: orbita-outline-march 1.1s linear infinite, orbita-outline-pulse 1.6s ease-in-out infinite !important; }
@media (prefers-reduced-motion: reduce) { .orbita-outline-rect { animation: none !important; } }`}</style>
      </svg>
    </>
  );
}
