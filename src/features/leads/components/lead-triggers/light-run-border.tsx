import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Contorno do Gatilho do lead (spec 0038): ligado, uma luz percorre a borda
// verde; com problema, a borda fica vermelha; desligado, neutra; "run", a luz
// numa borda neutra (botões de chamada).

/** "run": só a luz percorrendo uma borda neutra, sem o verde de "ligado". */
export type LightRunTone = "active" | "error" | "idle" | "run";

interface LightRunBorderProps {
  tone: LightRunTone;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

const LIGHT_RUN_GRADIENT =
  "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(190,242,100,0.35) 310deg, #d9f99d 345deg, #ffffff 355deg, transparent 360deg)";

const NEUTRAL_RUN_GRADIENT =
  "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(255,255,255,0.25) 310deg, rgba(255,255,255,0.85) 350deg, transparent 360deg)";

export function LightRunBorder({ tone, children, className, innerClassName }: LightRunBorderProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl p-[1.5px] transition-colors duration-500",
        (tone === "idle" || tone === "run") && "bg-border",
        tone === "error" && "bg-red-500/80 shadow-[0_0_18px_-4px_rgba(239,68,68,0.6)]",
        tone === "active" && "bg-emerald-500/50 shadow-[0_0_22px_-6px_rgba(16,185,129,0.7)]",
        className,
      )}
    >
      {(tone === "active" || tone === "run") && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[300%] -translate-x-1/2 -translate-y-1/2 animate-spin [animation-duration:3.5s] motion-reduce:animate-none"
          style={{ background: tone === "run" ? NEUTRAL_RUN_GRADIENT : LIGHT_RUN_GRADIENT }}
        />
      )}
      <div className={cn("relative h-full rounded-[calc(1rem-1.5px)]", innerClassName)}>{children}</div>
    </div>
  );
}
