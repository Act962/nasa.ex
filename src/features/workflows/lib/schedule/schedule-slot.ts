// Gatilho "Agendado" (spec 0039, RF-5). Puro e em horário de São Paulo.

export type ScheduleFrequency = "DAILY" | "WEEKDAYS" | "ONCE";

export interface WorkflowSchedule {
  frequency: ScheduleFrequency;
  /** "HH:mm". */
  time: string;
  /** 0 = domingo … 6 = sábado (WEEKDAYS). */
  weekdays?: number[];
  /** "YYYY-MM-DD" (ONCE). */
  date?: string;
}

/** São Paulo é UTC-3 o ano todo (sem horário de verão desde 2019). */
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60_000;
/** A varredura roda a cada 5 min; a folga cobre uma rodada atrasada. */
const DUE_WINDOW_MS = 15 * 60_000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseSchedule(raw: unknown): WorkflowSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<WorkflowSchedule>;
  if (!candidate.frequency || !["DAILY", "WEEKDAYS", "ONCE"].includes(candidate.frequency)) return null;
  if (!candidate.time || !TIME_PATTERN.test(candidate.time)) return null;
  return {
    frequency: candidate.frequency,
    time: candidate.time,
    weekdays: Array.isArray(candidate.weekdays) ? candidate.weekdays.filter((day) => Number.isInteger(day)) : undefined,
    date: typeof candidate.date === "string" ? candidate.date : undefined,
  };
}

/**
 * Horário vencido agora ("YYYY-MM-DD HH:mm") ou `null`. Vence quando o horário
 * de hoje já passou há menos de 15 min — cada horário tem uma chave única, e a
 * tabela de claim impede o segundo disparo.
 */
export function resolveDueSlot(schedule: WorkflowSchedule, now: Date): string | null {
  const wall = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  const dayKey = wall.toISOString().slice(0, 10);
  if (schedule.frequency === "ONCE" && schedule.date !== dayKey) return null;
  if (schedule.frequency === "WEEKDAYS" && !(schedule.weekdays ?? []).includes(wall.getUTCDay())) return null;

  const [hours, minutes] = schedule.time.split(":").map(Number);
  const slotWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), hours, minutes);
  const elapsedMs = wall.getTime() - slotWall;
  if (elapsedMs < 0 || elapsedMs >= DUE_WINDOW_MS) return null;
  return `${dayKey} ${schedule.time}`;
}

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function describeSchedule(schedule: WorkflowSchedule): string {
  if (schedule.frequency === "DAILY") return `Todo dia às ${schedule.time}`;
  if (schedule.frequency === "ONCE") {
    const [year, month, day] = (schedule.date ?? "").split("-");
    return `Em ${day}/${month}/${year} às ${schedule.time}`;
  }
  const days = (schedule.weekdays ?? []).map((day) => WEEKDAY_SHORT[day]).join(", ");
  return `Toda ${days || "—"} às ${schedule.time}`;
}
