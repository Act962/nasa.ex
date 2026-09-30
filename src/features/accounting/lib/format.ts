const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCentsBrl(cents: number): string {
  return BRL_FORMATTER.format(cents / 100);
}

/** 1234 bps → "12,34%". */
export function formatBps(bps: number, fractionDigits = 2): string {
  return `${(bps / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export function applyBps(amountCents: number, rateBps: number): number {
  return Math.round((amountCents * rateBps) / 10000);
}

/** Razão entre dois valores em bps, arredondada. Divisor zero → 0. */
export function ratioToBps(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000);
}

export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/** "2026-09" a partir de uma data (UTC). */
export function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearText, monthText] = monthKey.split("-");
  return { year: Number(yearText), month: Number(monthText) };
}

/** Mês anterior/seguinte a partir de "AAAA-MM". */
export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const shifted = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return toMonthKey(shifted);
}

/** "2026-T3" a partir de "2026-09". */
export function toQuarterKey(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return `${year}-T${Math.ceil(month / 3)}`;
}

export function quarterMonths(quarterKey: string): string[] {
  const [yearText, quarterText] = quarterKey.split("-T");
  const firstMonth = (Number(quarterText) - 1) * 3 + 1;
  return [0, 1, 2].map(
    (offset) => `${yearText}-${String(firstMonth + offset).padStart(2, "0")}`,
  );
}
