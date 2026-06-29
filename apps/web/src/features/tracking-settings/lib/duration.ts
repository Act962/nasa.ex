export type DurationUnit = "minutes" | "hours" | "days";

export interface DurationValue {
  value: number;
  unit: DurationUnit;
}

const UNIT_TO_MINUTES: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
};

export function toMinutes({ value, unit }: DurationValue): number {
  return Math.round(value * UNIT_TO_MINUTES[unit]);
}

export function fromMinutes(minutes: number): DurationValue {
  if (minutes <= 0) return { value: 1, unit: "minutes" };
  if (minutes % (60 * 24) === 0) {
    return { value: minutes / (60 * 24), unit: "days" };
  }
  if (minutes % 60 === 0) {
    return { value: minutes / 60, unit: "hours" };
  }
  return { value: minutes, unit: "minutes" };
}

export function formatMinutesPtBr(minutes: number): string {
  const { value, unit } = fromMinutes(minutes);
  const unitLabels: Record<DurationUnit, [string, string]> = {
    minutes: ["minuto", "minutos"],
    hours: ["hora", "horas"],
    days: ["dia", "dias"],
  };
  const [singular, plural] = unitLabels[unit];
  return `${value} ${value === 1 ? singular : plural}`;
}

export const DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
  { label: "1 dia", minutes: 60 * 24 },
  { label: "2 dias", minutes: 60 * 24 * 2 },
  { label: "7 dias", minutes: 60 * 24 * 7 },
];

export const MAX_IDLE_MINUTES = 60 * 24 * 90;
