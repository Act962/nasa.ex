"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface Level {
  id: string;
  order: number;
  name: string;
  requiredPoints: number;
  badgeNumber: number;
  planetEmoji: string;
  badgeUrl: string;
}

interface Seal {
  levelId: string;
  name: string;
  badgeNumber: number;
  planetEmoji: string;
  earnedAt: string;
  badgeUrl: string;
}

interface MySealsTabProps {
  totalPoints: number;
  allLevels: Level[];
  seals: Seal[];
}

export function MySealsTab({ totalPoints, allLevels, seals }: MySealsTabProps) {
  const earnedSet = new Set(seals.map((s) => s.levelId));

  const earned  = seals;
  const pending = allLevels.filter((l) => !earnedSet.has(l.id));

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* ── Earned seals ── */}
      {earned.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Selos conquistados ({earned.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {earned.map((seal) => (
              <div
                key={seal.levelId}
                className="relative flex flex-col items-center gap-2 rounded-2xl border border-[#7a1fe7]/30 bg-gradient-to-b from-[#7a1fe7]/10 to-transparent p-4 text-center"
              >
                <div className="relative w-24 h-24">
                  <Image
                    src={seal.badgeUrl}
                    alt={seal.name}
                    fill
                    className="object-contain drop-shadow-[0_0_12px_rgba(122,31,231,0.6)]"
                    unoptimized
                  />
                </div>
                <p className="text-sm font-bold text-foreground">{seal.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(seal.earnedAt).toLocaleDateString("pt-BR")}
                </p>
                <span className="absolute top-2 right-2 text-xs">{seal.planetEmoji}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pending seals ── */}
      {pending.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Próximos selos
          </p>
          <div className="grid grid-cols-3 gap-3">
            {pending.map((level) => {
              const progress = level.requiredPoints > 0
                ? Math.min(100, Math.round((totalPoints / level.requiredPoints) * 100))
                : 0;
              return (
                <div
                  key={level.id}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-muted/20 p-4 text-center opacity-70"
                >
                  <div className="relative w-24 h-24 grayscale">
                    <Image
                      src={level.badgeUrl}
                      alt={level.name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    {/* Lock overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/80 rounded-full p-1.5">
                        <svg className="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-foreground">{level.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {level.requiredPoints.toLocaleString("pt-BR")} pts necessários
                  </p>
                  {/* Mini progress bar */}
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7a1fe7] rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground">{progress}% concluído</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {earned.length === 0 && pending.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum nível configurado ainda.
        </p>
      )}
    </div>
  );
}
