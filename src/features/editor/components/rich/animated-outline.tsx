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
export const DASH_LENGTH = 14;
export const DASH_GAP = 8;
export const DASH_MARCH_ANIMATION = "orbita-outline-march 1.1s linear infinite";
const OUTLINE_LAP_SECONDS = 7;

const SHIP_COLOR = "var(--info)";

/** Navezinha azul de borda branca que percorre o desenho quando o fluxo está ligado. Aponta para a direita. */
export function FlowSpark({ color }: { color: string }) {
  return (
    <g
      className="orbita-flow-spark"
      transform="scale(1.6)"
      style={{ filter: `drop-shadow(0 0 2px rgba(0,0,0,.35)) drop-shadow(0 0 7px ${color})` }}
    >
      <path d="M-6 -2.2 L-13 0 L-6 2.2 Z" fill="#fb923c" stroke="white" strokeWidth={0.8} strokeLinejoin="round" />
      <path
        d="M-4 -3.4 L-8.5 -7.5 L-7 -2.4 Z M-4 3.4 L-8.5 7.5 L-7 2.4 Z"
        fill={SHIP_COLOR}
        stroke="white"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path
        d="M10 0 C6 -4.8 -3 -4.8 -6.5 -3 L-6.5 3 C-3 4.8 6 4.8 10 0 Z"
        fill={SHIP_COLOR}
        stroke="white"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <circle cx={2.2} cy={0} r={1.8} fill="white" />
    </g>
  );
}

export function AnimatedOutline({
  tone,
  showsSpark = false,
}: {
  tone: OutlineTone;
  showsSpark?: boolean;
}) {
  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute -inset-1.5 size-[calc(100%+0.75rem)] overflow-visible"
      >
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
            animation: DASH_MARCH_ANIMATION,
          }}
        />
        <style>{`@keyframes orbita-outline-march { to { stroke-dashoffset: -${DASH_LENGTH + DASH_GAP}; } }
@keyframes orbita-outline-lap { from { offset-distance: 0%; } to { offset-distance: 100%; } }
@media (prefers-reduced-motion: reduce) { .orbita-outline-rect { animation: none !important; } .orbita-flow-spark { display: none; } }`}</style>
      </svg>
      {showsSpark && (
        // Em HTML, `offset-path: inset()` acompanha o tamanho real do quadro, que o SVG não conhece.
        <div aria-hidden className="pointer-events-none absolute -inset-1.5">
          <div
            className="orbita-flow-spark absolute left-0 top-0 size-0"
            style={{
              offsetPath: `inset(${OUTLINE_WIDTH / 2}px round 16px)`,
              offsetRotate: "auto",
              animation: `orbita-outline-lap ${OUTLINE_LAP_SECONDS}s linear infinite`,
            }}
          >
            <svg className="overflow-visible" width={0} height={0}>
              <FlowSpark color={TONE_COLOR[tone]} />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}
