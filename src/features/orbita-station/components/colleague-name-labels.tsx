"use client";

import { useEffect, useState } from "react";
import type { RemoteLabel, StationEngine } from "../engine/station-engine";

/** Primeiro nome por cima de cada colega na estação (spec 0119, RF-6). Acompanha a câmera quadro a quadro. */
export function ColleagueNameLabels({ engine }: { engine: StationEngine }) {
  const [labels, setLabels] = useState<RemoteLabel[]>([]);

  useEffect(() => {
    let frameId = requestAnimationFrame(function follow() {
      setLabels(engine.remoteLabels());
      frameId = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frameId);
  }, [engine]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {labels.map((label) => (
        <span
          key={label.id}
          className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold backdrop-blur"
          style={{ left: label.x, top: label.y }}
        >
          {label.name}
        </span>
      ))}
    </div>
  );
}
