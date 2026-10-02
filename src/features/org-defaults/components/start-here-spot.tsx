"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dismissStartHere, isStartHereDismissed } from "../lib/sample-lead";

// Destaque "Clique aqui" do primeiro acesso (spec 0043): contorno azul girando + seta.

const RING_MASK: CSSProperties = {
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
  padding: 2,
};

type StartHereSpotProps = {
  scope: "tracking" | "lead";
  targetId: string;
  isEnabled: boolean;
  arrowSide?: "right" | "left";
  coachPlacement?: "above" | "below";
  radiusClassName?: string;
  className?: string;
  children: ReactNode;
};

export function StartHereSpot({
  scope,
  targetId,
  isEnabled,
  arrowSide = "right",
  coachPlacement = "above",
  radiusClassName = "rounded-xl",
  className,
  children,
}: StartHereSpotProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(isEnabled && !isStartHereDismissed(scope, targetId));
  }, [isEnabled, scope, targetId]);

  if (!isVisible) return <>{children}</>;

  return (
    <div
      className={cn("relative", className)}
      onClickCapture={() => dismissStartHere(scope, targetId)}
    >
      {children}
      <div aria-hidden className={cn("pointer-events-none absolute -inset-[2px] z-20 overflow-hidden", radiusClassName)} style={RING_MASK}>
        <div
          className="absolute left-1/2 top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite]"
          style={{ background: "conic-gradient(var(--chart-3), var(--chart-1), var(--info), var(--chart-3))" }}
        />
      </div>
      <div aria-hidden className={cn("pointer-events-none absolute -inset-[2px] z-10 animate-ping opacity-30 ring-2 ring-info", radiusClassName)} style={{ animationDuration: "2s" }} />
      <div
        className={cn(
          "pointer-events-none absolute z-30 flex items-center gap-1.5 animate-bounce",
          coachPlacement === "above" ? "-top-11" : "top-[calc(100%+6px)]",
          arrowSide === "right" ? "right-2 flex-row" : "left-24 flex-row-reverse",
        )}
        style={{ animationDuration: "1.4s" }}
      >
        <span className="whitespace-nowrap rounded-lg bg-info px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-info/40">
          Clique aqui
        </span>
        <svg
          viewBox="0 0 48 48"
          className={cn(
            "size-9 drop-shadow-[0_4px_10px_rgba(37,99,235,0.5)]",
            arrowSide === "left" && "-scale-x-100",
            coachPlacement === "below" && "-scale-y-100",
          )}
        >
          <path d="M40 6 C 30 10, 22 20, 14 34" stroke="var(--info)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M8 30 L14 38 L22 32" stroke="var(--info)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
