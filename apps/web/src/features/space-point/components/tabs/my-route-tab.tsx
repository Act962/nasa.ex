"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Level {
  id: string;
  order: number;
  name: string;
  requiredPoints: number;
  badgeNumber: number;
  planetEmoji: string;
}

interface MyRouteTabProps {
  totalPoints: number;
  allLevels: Level[];
  earnedLevelIds: Set<string>;
  currentLevel: { order: number; name: string; planetEmoji: string } | null;
  progressPct: number;
}

// Animated planet component
function Planet({
  emoji, name, points, isEarned, isCurrent, isNext, size = 48, delay = 0,
}: {
  emoji: string; name: string; points: number; isEarned: boolean;
  isCurrent: boolean; isNext: boolean; size?: number; delay?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 group" style={{ animationDelay: `${delay}ms` }}>
      {/* Planet orb */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-500",
          "animate-[float_4s_ease-in-out_infinite]",
          isCurrent && "ring-4 ring-[#7a1fe7]/70 ring-offset-2 ring-offset-[#050510]",
          isNext && "ring-2 ring-dashed ring-[#7a1fe7]/40 ring-offset-1 ring-offset-[#050510]",
          !isEarned && !isCurrent && !isNext && "opacity-40 grayscale",
        )}
        style={{
          width: size, height: size,
          animationDelay: `${delay}ms`,
          background: isEarned
            ? "radial-gradient(circle at 35% 35%, rgba(122,31,231,0.4), rgba(122,31,231,0.1))"
            : "rgba(255,255,255,0.03)",
          border: isEarned ? "1px solid rgba(122,31,231,0.4)" : "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <span style={{ fontSize: size * 0.5 }}>{emoji}</span>

        {/* Current rocket indicator */}
        {isCurrent && (
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-base animate-bounce"
            title="Você está aqui"
          >
            🚀
          </span>
        )}

        {/* Glow for earned */}
        {isEarned && (
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-md"
            style={{ background: "radial-gradient(circle, #7a1fe7, transparent)" }}
          />
        )}
      </div>

      {/* Label */}
      <p className={cn(
        "text-[10px] font-semibold text-center leading-tight",
        isCurrent ? "text-[#a78bfa]" : isEarned ? "text-foreground" : "text-muted-foreground",
      )}>
        {name}
      </p>
      <p className="text-[9px] text-muted-foreground tabular-nums">
        {points.toLocaleString("pt-BR")} pts
      </p>
    </div>
  );
}

// Animated connecting line
function PathLine({ earned }: { earned: boolean }) {
  return (
    <div className="flex-1 flex items-center px-1">
      <div className={cn(
        "h-px w-full rounded-full",
        earned ? "bg-gradient-to-r from-[#7a1fe7] to-[#7a1fe7]" : "bg-border/30",
      )}>
        {earned && (
          <div className="h-px w-full bg-gradient-to-r from-[#7a1fe7] via-[#a855f7] to-[#7a1fe7] animate-pulse" />
        )}
      </div>
    </div>
  );
}

export function MyRouteTab({
  totalPoints, allLevels, earnedLevelIds, currentLevel, progressPct,
}: MyRouteTabProps) {
  // Split into rows of 3
  const rows: Level[][] = [];
  for (let i = 0; i < allLevels.length; i += 3) {
    rows.push(allLevels.slice(i, i + 3));
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Points summary */}
      <div className="flex items-center justify-between bg-[#7a1fe7]/10 border border-[#7a1fe7]/20 rounded-2xl px-4 py-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Seus pontos</p>
          <p className="text-2xl font-extrabold tabular-nums text-[#a78bfa]">
            {totalPoints.toLocaleString("pt-BR")}
          </p>
        </div>
        {currentLevel && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nível atual</p>
            <p className="text-sm font-bold text-foreground flex items-center gap-1 justify-end">
              <span>{currentLevel.planetEmoji}</span>
              {currentLevel.name}
            </p>
          </div>
        )}
      </div>

      {/* Progress to next level */}
      {progressPct < 100 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Progresso para próximo nível</span>
            <span className="font-semibold text-[#a78bfa]">{progressPct}%</span>
          </div>
          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7a1fe7] to-[#a855f7] transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Space background */}
      <div className="relative rounded-2xl overflow-hidden bg-[#050510] border border-[#7a1fe7]/20 p-6">
        {/* Stars background */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width:   i % 5 === 0 ? 2 : 1,
                height:  i % 5 === 0 ? 2 : 1,
                left:    `${((i * 1_234_567 + 89) % 9_973) / 9_973 * 100}%`,
                top:     `${((i * 7_654_321 + 31) % 9_973) / 9_973 * 100}%`,
                opacity: 0.15 + (i % 7) * 0.08,
                animation: `twinkle ${2 + (i % 4)}s ease-in-out infinite`,
                animationDelay: `${(i % 10) * 0.3}s`,
              }}
            />
          ))}
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.6; }
          }
        `}</style>

        {/* Planet rows */}
        <div className="relative z-10 flex flex-col gap-8">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-end justify-around gap-2">
              {row.map((level, colIdx) => {
                const globalIdx = rowIdx * 3 + colIdx;
                const isEarned  = earnedLevelIds.has(level.id);
                const isCurrent = currentLevel?.order === level.order;
                const isNext    = !isEarned && !isCurrent && allLevels
                  .filter((l) => !earnedLevelIds.has(l.id))
                  .sort((a, b) => a.order - b.order)[0]?.id === level.id;
                const size = isCurrent ? 64 : isNext ? 52 : 44;
                return (
                  <Planet
                    key={level.id}
                    emoji={level.planetEmoji}
                    name={level.name}
                    points={level.requiredPoints}
                    isEarned={isEarned}
                    isCurrent={isCurrent}
                    isNext={isNext}
                    size={size}
                    delay={globalIdx * 200}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        🚀 = Sua posição atual na rota espacial
      </p>
    </div>
  );
}
