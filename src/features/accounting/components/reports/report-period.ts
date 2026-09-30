export type ReportPeriodPreset = "this_month" | "last_month" | "this_year" | "custom";

export interface ReportPeriod {
  from: string;
  to: string;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthRange(year: number, monthIndex: number): ReportPeriod {
  return { from: toIsoDate(new Date(year, monthIndex, 1)), to: toIsoDate(new Date(year, monthIndex + 1, 0)) };
}

export function resolvePresetPeriod(preset: Exclude<ReportPeriodPreset, "custom">, today = new Date()): ReportPeriod {
  if (preset === "this_month") return monthRange(today.getFullYear(), today.getMonth());
  if (preset === "last_month") return monthRange(today.getFullYear(), today.getMonth() - 1);
  return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to: toIsoDate(today) };
}

/** "2026-09-01" → "01/09/2026" sem passar por fuso. */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function formatJournalDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
