"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

export function SalesGoalTeamsCarousel({
  teams,
  selectedId,
  onSelect,
  autoAdvanceSeconds,
  accent,
}: {
  teams: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  autoAdvanceSeconds: number;
  accent: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState(autoAdvanceSeconds);

  useEffect(() => {
    setRemaining(autoAdvanceSeconds);
  }, [autoAdvanceSeconds]);

  useEffect(() => {
    if (!playing || teams.length === 0) return;
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          const currentIndex = teams.findIndex((team) => team.id === selectedId);
          const nextIndex = (currentIndex + 1) % teams.length;
          onSelect(teams[nextIndex].id);
          return autoAdvanceSeconds;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playing, teams, selectedId, autoAdvanceSeconds, onSelect]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-white/5">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-[11px] text-muted-foreground shrink-0">Times Ativos:</span>
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => onSelect(team.id)}
            title={team.name}
            className="size-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 transition-all"
            style={
              team.id === selectedId
                ? { borderColor: accent, background: accent + "33", color: accent }
                : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }
            }
          >
            {team.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {String(minutes).padStart(2, "0")}m:{String(seconds).padStart(2, "0")}s | Restantes...
        </span>
        <button
          onClick={() => setPlaying((current) => !current)}
          className="size-8 rounded-full flex items-center justify-center"
          style={{ background: accent }}
        >
          {playing ? <Pause className="size-3.5 text-white" /> : <Play className="size-3.5 text-white ml-0.5" />}
        </button>
      </div>
    </div>
  );
}
