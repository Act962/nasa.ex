export type SlaState = {
  deadline: Date | null;
  totalMs: number | null;
  remainingMs: number | null;
  consumedPct: number | null;
  isBreached: boolean;
};

// Tipo mínimo do Status referente ao SLA por etapa.
// Mantemos local até `prisma generate` rodar pós-migration.
export type StatusWithSla = { slaHours?: number | null };

export function computeSlaDeadline(
  status: StatusWithSla | null | undefined,
  enteredAt: Date | string | null | undefined,
): Date | null {
  const hours = status?.slaHours;
  if (!hours || !enteredAt) return null;
  const start = enteredAt instanceof Date ? enteredAt : new Date(enteredAt);
  if (isNaN(start.getTime())) return null;
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

export function computeSlaState(
  enteredAt: Date | string | null | undefined,
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): SlaState {
  if (!deadline) {
    return {
      deadline: null,
      totalMs: null,
      remainingMs: null,
      consumedPct: null,
      isBreached: false,
    };
  }
  const dl = deadline instanceof Date ? deadline : new Date(deadline);
  if (isNaN(dl.getTime())) {
    return {
      deadline: null,
      totalMs: null,
      remainingMs: null,
      consumedPct: null,
      isBreached: false,
    };
  }
  const start = enteredAt
    ? enteredAt instanceof Date
      ? enteredAt
      : new Date(enteredAt)
    : null;
  const totalMs =
    start && !isNaN(start.getTime()) ? dl.getTime() - start.getTime() : null;
  const remainingMs = dl.getTime() - now.getTime();
  const consumedPct =
    totalMs && totalMs > 0
      ? Math.max(0, Math.min(999, ((totalMs - remainingMs) / totalMs) * 100))
      : null;
  return {
    deadline: dl,
    totalMs,
    remainingMs,
    consumedPct,
    isBreached: remainingMs < 0,
  };
}

export function slaBadgeColor(consumedPct: number | null, isBreached: boolean): string {
  if (isBreached) return "bg-red-500/15 text-red-700 border-red-500/30";
  if (consumedPct === null) return "bg-muted text-muted-foreground";
  if (consumedPct >= 70) return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
  return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
}

export function formatRemaining(remainingMs: number | null): string {
  if (remainingMs === null) return "—";
  const abs = Math.abs(remainingMs);
  const totalMinutes = Math.floor(abs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const sign = remainingMs < 0 ? "-" : "";
  if (days > 0) return `${sign}${days}d ${remainingHours}h`;
  if (hours > 0) return `${sign}${hours}h ${minutes}m`;
  return `${sign}${minutes}m`;
}
