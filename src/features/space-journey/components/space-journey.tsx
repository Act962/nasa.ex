"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildTrailPath,
  headingDegrees,
  layoutJourney,
  starsCollected,
  type JourneyStop,
} from "../lib/journey-layout";
import { Asteroid } from "./asteroid";
import { Planet } from "./planet";
import { Rocket } from "./rocket";

const BACKDROP_STARS = Array.from({ length: 28 }, (_, index) => ({
  left: (index * 37) % 100,
  top: (index * 53) % 100,
  delayMs: (index * 410) % 3000,
  isBig: index % 5 === 0,
}));

/**
 * Jornada espacial: planetas são as etapas, asteroides os passos entre elas,
 * e o foguete sobe até a parada atual — a cada parada o cliente ganha STARs.
 */
export function SpaceJourney({
  stops,
  currentIndex,
  title = "Sua jornada",
  className,
  starCount,
  fuelLabel = "Combustível",
}: {
  stops: JourneyStop[];
  /** Paradas concluídas; o foguete fica na próxima (ou no destino, quando todas foram feitas). */
  currentIndex: number;
  title?: string;
  className?: string;
  /** Quando o saldo real vem de fora (ex.: STAR FRIENDS), substitui o cálculo +1/+5 por parada. */
  starCount?: number;
  fuelLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aspectRatio, setAspectRatio] = useState(2.5);
  const points = useMemo(() => layoutJourney(stops), [stops]);
  const safeIndex = Math.max(0, Math.min(currentIndex, stops.length - 1));
  const rocketPoint = points[safeIndex];
  const trailPath = useMemo(() => buildTrailPath(points), [points]);
  const donePath = useMemo(() => buildTrailPath(points.slice(0, safeIndex + 1)), [points, safeIndex]);
  const stars = starCount ?? starsCollected(stops, safeIndex);
  // Mesmo cálculo de "N de total": chegar ao destino (currentIndex = total) é 100%.
  const fuelPercent = stops.length ? Math.round((Math.min(Math.max(currentIndex, 0), stops.length) / stops.length) * 100) : 0;
  const starGain = useStarGain(stars);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) setAspectRatio(height / width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (!rocketPoint) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate h-full min-h-[420px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#1b1640] via-[#231a52] to-[#0f0c29] text-white",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-12 size-44 rounded-full bg-sky-500/15 blur-3xl" />
      {BACKDROP_STARS.map((backdropStar, index) => (
        <span
          key={index}
          className={cn("animate-space-twinkle absolute rounded-full bg-white", backdropStar.isBig ? "size-1" : "size-0.5")}
          style={{ left: `${backdropStar.left}%`, top: `${backdropStar.top}%`, animationDelay: `${backdropStar.delayMs}ms` }}
        />
      ))}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-3">
        <span className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">{title}</span>
        <span className="relative flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold backdrop-blur">
          <Star className="size-3.5 fill-amber-400 text-amber-400" /> {stars}
          {starGain && (
            <span key={starGain.key} className="animate-star-gain absolute -top-1 right-0 text-xs font-bold text-amber-300">
              +{starGain.amount}
            </span>
          )}
        </span>
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <path d={trailPath} fill="none" stroke="#a78bfa" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        <path d={donePath} fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
      </svg>

      {stops.map((stop, index) => {
        const point = points[index];
        const isDone = index < safeIndex;
        const isCurrent = index === safeIndex;
        const isLocked = index > safeIndex;
        const isLabelLeft = point.x > 50;
        return (
          <div
            key={stop.id}
            title={stop.label}
            className={cn(
              "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center transition-all duration-500",
              isLocked && "opacity-45 saturate-50",
            )}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            {stop.kind === "planet" ? (
              <div className="relative">
                {isCurrent && <span className="absolute inset-1 animate-ping rounded-full bg-emerald-400/30" />}
                <Planet
                  palette={stop.palette}
                  surface={stop.surface}
                  hasRing={stop.hasRing}
                  size={stop.isDestination ? 52 : isCurrent ? 42 : 34}
                />
                {isDone && (
                  <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#1b1640]">
                    <Check className="size-2.5" strokeWidth={4} />
                  </span>
                )}
                {stop.label && (
                  <span
                    className={cn(
                      "absolute top-1/2 w-20 -translate-y-1/2 text-[10px] leading-tight font-medium",
                      isLabelLeft ? "right-full mr-1 text-right" : "left-full ml-1",
                      isDone ? "text-emerald-300" : "text-white/80",
                    )}
                  >
                    {stop.label}
                  </span>
                )}
              </div>
            ) : (
              <Asteroid size={isCurrent ? 16 : 11} className={cn(isDone && "opacity-60")} />
            )}
          </div>
        );
      })}

      <div
        className="absolute z-20 transition-all duration-700 ease-out"
        style={{ left: `${rocketPoint.x}%`, top: `${rocketPoint.y}%`, transform: "translate(-50%, -70%)" }}
      >
        <div
          className="animate-rocket-hover transition-transform duration-700"
          style={{ rotate: `${headingDegrees(rocketPoint, points[safeIndex + 1], aspectRatio)}deg` }}
        >
          <Rocket size={26} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 space-y-1 bg-gradient-to-t from-[#0f0c29] to-transparent px-3 pt-6 pb-3">
        <div className="flex justify-between text-[10px] text-white/70">
          <span>{fuelLabel}</span>
          <span>{fuelPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-emerald-400 transition-all duration-700"
            style={{ width: `${fuelPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** "+N" que sobe e some quando o total de STARs aumenta. */
function useStarGain(stars: number) {
  const previousStars = useRef(stars);
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null);
  useEffect(() => {
    const amount = stars - previousStars.current;
    previousStars.current = stars;
    if (amount <= 0) return;
    setGain({ amount, key: Date.now() });
    const timeout = setTimeout(() => setGain(null), 1400);
    return () => clearTimeout(timeout);
  }, [stars]);
  return gain;
}
