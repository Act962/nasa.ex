"use client";

import { cn } from "@/lib/utils";
import type { NextDueFilter } from "@/features/form-records/lib/next-due-window";

// Próxima data na lista de fichas (spec 0081, RF-5): filtro e a célula com "em 5 dias" / "venceu há 7 dias".

const DAY_MS = 24 * 60 * 60_000;
const SOON_DAYS = 7;

const FILTER_OPTIONS: { value: NextDueFilter | undefined; label: string }[] = [
  { value: undefined, label: "Todas" },
  { value: "overdue", label: "Vencidas" },
  { value: "week", label: "Próximos 7 dias" },
  { value: "month", label: "Até o fim do mês" },
];

function toBrazilDayIndex(date: Date): number {
  return Math.floor((date.getTime() - 3 * 60 * 60_000) / DAY_MS);
}

function formatDay(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** "hoje", "em 5 dias", "em 6 meses", "venceu há 7 dias". */
export function describeNextDue(isoDate: string, now = new Date()): { text: string; tone: "late" | "soon" | "later" } {
  const daysAhead = toBrazilDayIndex(new Date(isoDate)) - toBrazilDayIndex(now);
  if (daysAhead < 0) {
    const daysLate = -daysAhead;
    return { text: daysLate === 1 ? "venceu ontem" : `venceu há ${daysLate} dias`, tone: "late" };
  }
  if (daysAhead === 0) return { text: "hoje", tone: "soon" };
  if (daysAhead === 1) return { text: "amanhã", tone: "soon" };
  if (daysAhead <= 60) return { text: `em ${daysAhead} dias`, tone: daysAhead <= SOON_DAYS ? "soon" : "later" };
  const monthsAhead = Math.round(daysAhead / 30);
  return { text: `em ${monthsAhead} meses`, tone: "later" };
}

const TONE_CLASS = { late: "text-destructive", soon: "text-warning", later: "" } as const;

export function NextDueFilterChips({
  value,
  onChange,
}: {
  value: NextDueFilter | undefined;
  onChange: (nextValue: NextDueFilter | undefined) => void;
}) {
  return (
    <div className="scroll-hidden-x flex min-w-0 items-center gap-2 max-md:-mx-4 max-md:overflow-x-auto max-md:px-4" role="group" aria-label="Filtrar pela próxima data">
      <span className="shrink-0 text-xs text-muted-foreground">Próxima data:</span>
      {FILTER_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors max-md:min-h-11",
              isActive ? "border-info/50 bg-info/15 text-info" : "border-foreground/10 text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Data e distância; sem data, o motivo mais comum: já existe ficha mais nova do mesmo item. */
export function NextDueCell({ nextDueAt, isFinalized }: { nextDueAt: string | null; isFinalized: boolean }) {
  if (!nextDueAt) {
    return <span className="text-muted-foreground" title={isFinalized ? "Já existe ficha mais nova deste item" : "Rascunho não tem próxima data"}>—</span>;
  }
  const described = describeNextDue(nextDueAt);
  return (
    <span className="flex flex-col leading-tight">
      <span className={cn("tabular-nums", TONE_CLASS[described.tone])}>{formatDay(nextDueAt)}</span>
      <span className="text-[11px] text-muted-foreground">{described.text}</span>
    </span>
  );
}

/** Uma linha só, para o cartão do celular: "Próximo: 14/10/2026 · em 5 dias". */
export function NextDueLine({ nextDueAt }: { nextDueAt: string }) {
  const described = describeNextDue(nextDueAt);
  return (
    <span className={cn("text-xs", TONE_CLASS[described.tone] || "text-muted-foreground")}>
      Próximo: {formatDay(nextDueAt)} · {described.text}
    </span>
  );
}
