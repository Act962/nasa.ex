"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import type { ColleagueInfo, RoomLabel, StationEngine } from "../engine/station-engine";

interface StationMapLabelsProps {
  engine: StationEngine;
  onPickRoom: (roomKey: string) => void;
  onPickColleague: (colleague: ColleagueInfo) => void;
}

/**
 * Nomes das salas por cima do canvas no modo mapa (clicar leva o personagem até a sala) e a lista de quem está na
 * estação. Colega em sala trancada não aparece no 3D, mas continua na lista como "em sala restrita" (spec 0120, CA-6).
 */
export function StationMapLabels({ engine, onPickRoom, onPickColleague }: StationMapLabelsProps) {
  const [labels, setLabels] = useState<RoomLabel[]>([]);
  const [colleagues, setColleagues] = useState<ColleagueInfo[]>(() => engine.colleagues());

  // A câmera se move suavemente até a visão de cima: as posições acompanham quadro a quadro.
  useEffect(() => {
    let frameId = requestAnimationFrame(function follow() {
      setLabels(engine.roomLabels());
      frameId = requestAnimationFrame(follow);
    });
    const colleagueTimer = setInterval(() => setColleagues(engine.colleagues()), 500);
    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(colleagueTimer);
    };
  }, [engine]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {colleagues.length > 0 && (
        <div className="pointer-events-auto absolute left-4 top-24 z-10 max-h-[40dvh] w-56 overflow-y-auto rounded-2xl bg-black/60 p-3 backdrop-blur">
          <p className="mb-1 text-xs uppercase tracking-wider text-white/60">Na estação</p>
          <ul className="space-y-0.5">
            {colleagues.map((colleague) => (
              <li key={colleague.id}>
                <button type="button" onClick={() => onPickColleague(colleague)} className="w-full rounded-lg px-2 py-1 text-left text-sm transition hover:bg-white/10">
                  <span className="block truncate font-semibold">{colleague.name}</span>
                  <span className="block truncate text-xs text-white/60">
                    {colleague.isRestricted ? "Em sala restrita" : (colleague.room?.name ?? "Corredor")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {labels.map((label) => (
        <button
          key={label.key}
          type="button"
          onClick={() => onPickRoom(label.key)}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 bg-black/60 px-2 py-0.5 sm:px-3 sm:py-1 text-left backdrop-blur transition hover:bg-black/80"
          style={{ left: label.x, top: label.y, borderColor: label.color }}
        >
          <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold leading-tight sm:text-sm">
            {label.isLocked && <Lock className="size-3 text-destructive" aria-label="Sem acesso" />}
            {label.name}
          </span>
          {label.module !== "—" && <span className="hidden whitespace-nowrap text-[11px] text-white/70 sm:block">{label.module}</span>}
        </button>
      ))}
    </div>
  );
}
