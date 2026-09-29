import type { SampleSeedContext } from "./types";

export function sampleName(name: string): string {
  return `${name} (exemplo)`;
}

export function shortRandomSuffix(): string {
  return crypto.randomUUID().slice(0, 6);
}

// Brasília não tem horário de verão desde 2019: UTC-3 fixo.
const BRASILIA_UTC_OFFSET_HOURS = 3;

export function atBrasiliaTime(date: Date, hour: number, minute = 0): Date {
  const adjusted = new Date(date);
  adjusted.setUTCHours(hour + BRASILIA_UTC_OFFSET_HOURS, minute, 0, 0);
  return adjusted;
}

export function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return atBrasiliaTime(date, hour, minute);
}

export function findTrackingByName(context: SampleSeedContext, trackingName: string) {
  return context.trackings.find((tracking) => tracking.name === trackingName) ?? context.trackings[0];
}

export function toUrlSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
