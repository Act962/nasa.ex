/**
 * Minutos de um passo "Esperar" no Modo Agente (spec 0112). Aceita os dois formatos gravados:
 * - minúsculo (`{ type: "days", days: 2 }`), dos modelos prontos e do ASTRO: duração pura;
 * - maiúsculo (`{ type: "DAYS", days: 2, hours: 9, minutes: 0 }`), da janela do editor: em
 *   dias, semanas e meses o horário é a hora do dia em que o fluxo segue, como no motor clássico.
 */
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const WAIT_TIMEZONE = "America/Sao_Paulo";
const MINUTES_PER_UNIT: Record<string, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  weeks: 60 * 24 * 7,
  months: 60 * 24 * 30,
};
const CALENDAR_UNITS = new Set(["days", "weeks", "months"]);

export function resolveWaitMinutes(
  action: Record<string, unknown>,
  now: Date = new Date(),
): number {
  const rawUnit = String(action.type ?? action.unit ?? "minutes");
  const unit = rawUnit.toLowerCase();
  const amount = Number(action[unit] ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const isEditorCalendarWait =
    rawUnit !== unit && CALENDAR_UNITS.has(unit);
  if (!isEditorCalendarWait) return amount * (MINUTES_PER_UNIT[unit] ?? 1);

  const startOfWait = dayjs(now).tz(WAIT_TIMEZONE);
  const target = startOfWait
    .add(amount, unit.slice(0, -1) as "day" | "week" | "month")
    .set("hour", Number(action.hours ?? 0))
    .set("minute", Number(action.minutes ?? 0))
    .set("second", 0)
    .set("millisecond", 0);
  return Math.max(0, Math.ceil(target.diff(startOfWait, "minute", true)));
}
