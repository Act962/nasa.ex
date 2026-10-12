// Janelas da "próxima data" de uma ficha (spec 0081), em dias de Brasília.

const BRAZIL_OFFSET_MS = 3 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

export const NEXT_DUE_FILTERS = ["overdue", "week", "month"] as const;
export type NextDueFilter = (typeof NEXT_DUE_FILTERS)[number];

/** 00:00 de hoje em Brasília, como instante. */
export function startOfBrazilDay(now = new Date()): Date {
  const wallClock = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  wallClock.setUTCHours(0, 0, 0, 0);
  return new Date(wallClock.getTime() + BRAZIL_OFFSET_MS);
}

/** Primeiro instante do mês seguinte ao de hoje, em Brasília. */
function startOfNextBrazilMonth(now = new Date()): Date {
  const wallClock = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  wallClock.setUTCDate(1);
  wallClock.setUTCMonth(wallClock.getUTCMonth() + 1);
  wallClock.setUTCHours(0, 0, 0, 0);
  return new Date(wallClock.getTime() + BRAZIL_OFFSET_MS);
}

/** Vencidas = antes de hoje; semana = de hoje aos próximos 7 dias; mês = de hoje ao fim do mês. */
export function nextDueBounds(filter: NextDueFilter, now = new Date()): { gte?: Date; lt: Date } {
  const today = startOfBrazilDay(now);
  if (filter === "overdue") return { lt: today };
  if (filter === "week") return { gte: today, lt: new Date(today.getTime() + 7 * DAY_MS) };
  return { gte: today, lt: startOfNextBrazilMonth(now) };
}
