// Datas esperadas pela bateria, no fuso de Brasília (fixo em -03:00 desde 2019).

const BRAZIL_OFFSET_MS = -3 * 60 * 60_000;

/** Instante de "daqui a `dayOffset` dias, às hour:minute" no relógio de Brasília. */
export function brazilDateTime(dayOffset: number, hour: number, minute = 0, now = new Date()): Date {
  const wallClock = new Date(now.getTime() + BRAZIL_OFFSET_MS);
  wallClock.setUTCDate(wallClock.getUTCDate() + dayOffset);
  wallClock.setUTCHours(hour, minute, 0, 0);
  return new Date(wallClock.getTime() - BRAZIL_OFFSET_MS);
}

/** Próxima ocorrência do dia da semana (0 = domingo). Hoje não conta. */
export function nextBrazilWeekday(weekday: number, hour: number, minute = 0, now = new Date()): Date {
  const wallClock = new Date(now.getTime() + BRAZIL_OFFSET_MS);
  const delta = (weekday - wallClock.getUTCDay() + 7) % 7 || 7;
  return brazilDateTime(delta, hour, minute, now);
}

export function startOfBrazilDay(dayOffset = 0, now = new Date()): Date {
  return brazilDateTime(dayOffset, 0, 0, now);
}

export function formatBrazilDateTime(value: Date): string {
  return value.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
