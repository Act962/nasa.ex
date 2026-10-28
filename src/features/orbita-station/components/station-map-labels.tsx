"use client";

import { useEffect, useState } from "react";
import type { RoomLabel, StationEngine } from "../engine/station-engine";

/** Nomes das salas por cima do canvas no modo mapa. Clicar leva o personagem até a sala. */
export function StationMapLabels({ engine, onPickRoom }: { engine: StationEngine; onPickRoom: (roomKey: string) => void }) {
  const [labels, setLabels] = useState<RoomLabel[]>([]);

  // A câmera se move suavemente até a visão de cima: as posições acompanham quadro a quadro.
  useEffect(() => {
    let frameId = requestAnimationFrame(function follow() {
      setLabels(engine.roomLabels());
      frameId = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frameId);
  }, [engine]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {labels.map((label) => (
        <button
          key={label.key}
          type="button"
          onClick={() => onPickRoom(label.key)}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 bg-black/60 px-3 py-1 text-left backdrop-blur transition hover:bg-black/80"
          style={{ left: label.x, top: label.y, borderColor: label.color }}
        >
          <span className="block whitespace-nowrap text-sm font-semibold leading-tight">{label.name}</span>
          {label.module !== "—" && <span className="block whitespace-nowrap text-[11px] text-white/70">{label.module}</span>}
        </button>
      ))}
    </div>
  );
}
