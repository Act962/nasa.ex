// Contorno tracejado em movimento dos quadros na visão "Visual" (spec 0090): azul quando o passo
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
const DASH_LENGTH = 14;
const DASH_GAP = 8;

export function AnimatedOutline({ tone }: { tone: OutlineTone }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute -inset-1.5 size-[calc(100%+0.75rem)] overflow-visible">
      <rect
        className="orbita-outline-rect"
        x={OUTLINE_WIDTH / 2}
        y={OUTLINE_WIDTH / 2}
        rx={16}
        fill="none"
        stroke={TONE_COLOR[tone]}
        strokeWidth={OUTLINE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={`${DASH_LENGTH} ${DASH_GAP}`}
        // Largura e altura por CSS: o atributo do SVG não aceita `calc()`.
        style={{
          width: `calc(100% - ${OUTLINE_WIDTH}px)`,
          height: `calc(100% - ${OUTLINE_WIDTH}px)`,
          animation: "orbita-outline-march 1.1s linear infinite",
        }}
      />
      <style>{`@keyframes orbita-outline-march { to { stroke-dashoffset: -${DASH_LENGTH + DASH_GAP}; } }
@media (prefers-reduced-motion: reduce) { .orbita-outline-rect { animation: none !important; } }`}</style>
    </svg>
  );
}
