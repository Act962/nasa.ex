"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { QueueLabel, StationEngine } from "../engine/station-engine";
import type { WaitingLead } from "../hooks/use-orbita-station";
import { WAIT_LEVEL_CLASS, formatWait, waitLevel, waitSecondsSince } from "../lib/wait-time";

/** Tempo de espera por cima de cada lead da fila do chat (spec 0121, RF-11). Clicar abre o painel do lead. */
export function QueueLabels({ engine, leads, onPickLead }: { engine: StationEngine; leads: readonly WaitingLead[]; onPickLead: (leadId: string) => void }) {
  const [labels, setLabels] = useState<QueueLabel[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let frameId = requestAnimationFrame(function follow() {
      setLabels(engine.queueLabels());
      frameId = requestAnimationFrame(follow);
    });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(clock);
    };
  }, [engine]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {labels.map((label) => {
        if (label.id === null) {
          return (
            <span
              key="overflow"
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold backdrop-blur"
              style={{ left: label.x, top: label.y }}
            >
              +{label.overflow} aguardando
            </span>
          );
        }
        const lead = leads.find((candidate) => candidate.id === label.id);
        if (!lead) return null;
        const seconds = waitSecondsSince(lead.waitingSince, now);
        return (
          <button
            key={label.id}
            type="button"
            onClick={() => onPickLead(lead.id)}
            aria-label={`${lead.name}: ${formatWait(seconds)} aguardando`}
            className={cn(
              "pointer-events-auto absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums shadow",
              WAIT_LEVEL_CLASS[waitLevel(seconds)],
            )}
            style={{ left: label.x, top: label.y }}
          >
            {formatWait(seconds)}
          </button>
        );
      })}
    </div>
  );
}
