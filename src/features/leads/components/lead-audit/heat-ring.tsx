import type { ReactNode } from "react";
import { HEAT_LEVELS, type HeatLevel } from "./lead-heat";

// Anel da temperatura calculada em volta do avatar (spec 0035, RF-10).
// "gauge": arco proporcional ao % com o selo no canto (lateral do lead).
// "color": o mesmo arco proporcional, fino e sem o selo do % (lista de conversas).

const DEFAULT_SIZE = 76;

interface HeatRingProps {
  heat: { score: number; level: HeatLevel } | null;
  children: ReactNode;
  /** Diâmetro em px. */
  size?: number;
  variant?: "gauge" | "color";
}

export function HeatRing({ heat, children, size = DEFAULT_SIZE, variant = "gauge" }: HeatRingProps) {
  // Sem métricas, sem anel — mas no mesmo espaço, para a lista ficar alinhada.
  const strokeWidth = variant === "color" ? 2.5 : 5;
  // Folga igual em volta: o avatar preenche o círculo interno do anel.
  const avatarInset = strokeWidth + 1.5;

  if (!heat && variant === "color") {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div className="absolute flex items-center justify-center" style={{ inset: avatarInset }}>
          {children}
        </div>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = heat ? HEAT_LEVELS[heat.level].color : undefined;
  const filled = Math.min(Math.max(heat?.score ?? 0, 0), 100) / 100;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={heat ? HEAT_LEVELS[heat.level].label : undefined}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
        {heat && filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - filled)}
            stroke={color}
            className="transition-[stroke-dashoffset,stroke] duration-500"
          />
        )}
      </svg>
      <div className="absolute flex items-center justify-center" style={{ inset: avatarInset }}>
        {children}
      </div>
      {heat && variant === "gauge" && (
        <span
          className="absolute -right-1 -bottom-1 rounded-full border bg-background px-1.5 text-[11px] font-bold"
          style={{ color, borderColor: color }}
        >
          {heat.score}%
        </span>
      )}
    </div>
  );
}
