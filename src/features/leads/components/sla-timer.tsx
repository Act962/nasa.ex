"use client";

import { useEffect, useState } from "react";
import { Timer, TimerOff } from "lucide-react";
import {
  computeSlaState,
  formatRemaining,
  slaBadgeColor,
} from "@/features/leads/lib/sla";

type Props = {
  enteredAt?: Date | string | null;
  deadline?: Date | string | null;
  compact?: boolean;
};

export function SlaTimer({ enteredAt, deadline, compact = false }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;

  const state = computeSlaState(enteredAt, deadline, now);
  const color = slaBadgeColor(state.consumedPct, state.isBreached);
  const Icon = state.isBreached ? TimerOff : Timer;
  const label = state.isBreached
    ? `+${formatRemaining(Math.abs(state.remainingMs ?? 0)).replace("-", "")}`
    : formatRemaining(state.remainingMs);

  return (
    <div
      className={`inline-flex items-center gap-1 rounded border px-1.5 ${color} ${
        compact ? "text-[10px] py-0" : "text-[11px] py-0.5"
      }`}
      title={
        state.isBreached
          ? "SLA da etapa estourou"
          : `Tempo restante na etapa: ${label}`
      }
    >
      <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span className="font-medium">{label}</span>
    </div>
  );
}
