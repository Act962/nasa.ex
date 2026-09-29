import { useId } from "react";
import { cn } from "@/lib/utils";
import type { PlanetPalette, PlanetSurface } from "../lib/journey-layout";

const PALETTES: Record<PlanetPalette, { light: string; base: string; dark: string; detail: string; ring: string }> = {
  amber: { light: "#fde68a", base: "#f59e0b", dark: "#b45309", detail: "#fbbf24", ring: "#fcd34d" },
  violet: { light: "#ddd6fe", base: "#8b5cf6", dark: "#5b21b6", detail: "#a78bfa", ring: "#c4b5fd" },
  teal: { light: "#99f6e4", base: "#14b8a6", dark: "#0f766e", detail: "#2dd4bf", ring: "#5eead4" },
  rose: { light: "#fecdd3", base: "#f43f5e", dark: "#9f1239", detail: "#fb7185", ring: "#fda4af" },
  sky: { light: "#bae6fd", base: "#0ea5e9", dark: "#075985", detail: "#38bdf8", ring: "#7dd3fc" },
  lime: { light: "#d9f99d", base: "#84cc16", dark: "#3f6212", detail: "#a3e635", ring: "#bef264" },
};

/** Planeta ilustrado (faixas ou crateras, anel opcional) — parada principal da jornada. */
export function Planet({
  palette = "violet",
  surface = "bands",
  hasRing = false,
  size = 40,
  className,
}: {
  palette?: PlanetPalette;
  surface?: PlanetSurface;
  hasRing?: boolean;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const colors = PALETTES[palette];
  const gradientId = `planet-gradient-${uid}`;
  const clipId = `planet-clip-${uid}`;
  const ringFrontId = `planet-ring-front-${uid}`;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={colors.light} />
          <stop offset="55%" stopColor={colors.base} />
          <stop offset="100%" stopColor={colors.dark} />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="34" />
        </clipPath>
        <clipPath id={ringFrontId}>
          <rect x="0" y="50" width="100" height="50" />
        </clipPath>
      </defs>

      {hasRing && (
        <ellipse cx="50" cy="50" rx="48" ry="13" fill="none" stroke={colors.ring} strokeWidth="5" opacity="0.55" transform="rotate(-18 50 50)" />
      )}
      <circle cx="50" cy="50" r="34" fill={`url(#${gradientId})`} />
      <g clipPath={`url(#${clipId})`} opacity="0.55">
        {surface === "bands" ? (
          <>
            <path d="M10 38 Q30 32 50 38 T90 36 L90 44 Q70 48 50 43 T10 46 Z" fill={colors.detail} />
            <path d="M10 58 Q35 52 55 58 T90 56 L90 62 Q65 67 45 62 T10 65 Z" fill={colors.dark} />
            <path d="M18 72 Q40 69 60 73 T88 71 L88 75 Q60 79 40 76 T18 77 Z" fill={colors.detail} />
          </>
        ) : (
          <>
            <circle cx="38" cy="40" r="7" fill={colors.dark} />
            <circle cx="62" cy="58" r="9" fill={colors.dark} />
            <circle cx="44" cy="68" r="4" fill={colors.dark} />
            <circle cx="66" cy="34" r="4" fill={colors.dark} />
          </>
        )}
      </g>
      <circle cx="50" cy="50" r="34" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
      {hasRing && (
        <g clipPath={`url(#${ringFrontId})`} transform="rotate(-18 50 50)">
          <ellipse cx="50" cy="50" rx="48" ry="13" fill="none" stroke={colors.ring} strokeWidth="5" />
        </g>
      )}
    </svg>
  );
}
