import { ReminderRecurrenceType } from "@/generated/prisma/enums";

// America/Sao_Paulo = UTC-3, fixo desde 2019 (sem horário de verão)
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Retorna a data local em BRT ("YYYY-MM-DD") para um timestamp UTC.
 * Usa aritmética pura de millisegundos — sem dependência de timezone do runtime.
 */
function dateBRT(utcDate: Date | string): string {
  const ms = typeof utcDate === "string" ? new Date(utcDate).getTime() : utcDate.getTime();
  const brt = new Date(ms - BRT_OFFSET_MS);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retorna o horário local em BRT ("HH:mm") para um timestamp UTC.
 */
function timeBRT(utcDate: Date | string): string {
  const ms = typeof utcDate === "string" ? new Date(utcDate).getTime() : utcDate.getTime();
  const brt = new Date(ms - BRT_OFFSET_MS);
  const h = String(brt.getUTCHours()).padStart(2, "0");
  const m = String(brt.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Cria um Date UTC a partir de uma data local BRT ("YYYY-MM-DD") e horário ("HH:mm").
 * BRT + 3h = UTC.
 */
function fromBRT(localDate: string, localTime: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hours, minutes] = localTime.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours + 3, minutes, 0, 0));
}

/** Retorna o número de dias no mês de uma data "YYYY-MM-DD" (tratada como UTC). */
function daysInMonth(localDate: string): number {
  const [year, month] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Avança uma data "YYYY-MM-DD" por N dias. */
function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Avança uma data "YYYY-MM-DD" por 1 mês. */
function addOneMonth(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month, day)); // month (1-based) → month (0-based + 1)
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ---------------------------------------------------------------------------

type ReminderBase = {
  recurrenceType: ReminderRecurrenceType;
  dayOfMonth: number | null;
  nextRemindAt: Date | null;
};

export function computeNextRemindAt(reminder: ReminderBase): Date | null {
  const { recurrenceType, dayOfMonth, nextRemindAt } = reminder;

  if (!nextRemindAt) return null;

  const localDate = dateBRT(nextRemindAt);
  const localTime = timeBRT(nextRemindAt);

  switch (recurrenceType) {
    case ReminderRecurrenceType.ONCE:
      return null;

    case ReminderRecurrenceType.WEEKLY:
      return fromBRT(addDays(localDate, 7), localTime);

    case ReminderRecurrenceType.BIWEEKLY:
      return fromBRT(addDays(localDate, 14), localTime);

    case ReminderRecurrenceType.MONTHLY: {
      const nextDate = addOneMonth(localDate);
      if (dayOfMonth) {
        const max = daysInMonth(nextDate);
        const clampedDay = Math.min(dayOfMonth, max);
        const [y, m] = nextDate.split("-");
        return fromBRT(`${y}-${m}-${String(clampedDay).padStart(2, "0")}`, localTime);
      }
      return fromBRT(nextDate, localTime);
    }
  }
}

/**
 * Calcula a primeira data de disparo interpretando horários como BRT (UTC-3).
 *
 * - Se `dayOfMonth` for fornecido (MONTHLY com dia fixo):
 *   calcula o próximo mês que contiver esse dia a partir de "agora" em BRT.
 *
 * - Caso contrário, usa `firstRemindAt` (ISO UTC) como base de data e aplica
 *   `remindTime` como horário BRT.
 */
export function buildFirstRemindAt(
  remindTime: string,
  firstRemindAt?: string,
  dayOfMonth?: number,
): Date {
  if (dayOfMonth) {
    const nowBRT = dateBRT(new Date());
    const [year, month] = nowBRT.split("-").map(Number);
    const dayStr = String(dayOfMonth).padStart(2, "0");
    const candidateDate = `${year}-${String(month).padStart(2, "0")}-${dayStr}`;
    let candidate = fromBRT(candidateDate, remindTime);

    if (candidate <= new Date()) {
      const nextDate = addOneMonth(candidateDate);
      const max = daysInMonth(nextDate);
      const clampedDay = Math.min(dayOfMonth, max);
      const [y, m] = nextDate.split("-");
      candidate = fromBRT(`${y}-${m}-${String(clampedDay).padStart(2, "0")}`, remindTime);
    }

    return candidate;
  }

  if (!firstRemindAt) {
    throw new Error("firstRemindAt é obrigatório quando dayOfMonth não é informado");
  }

  // Extrai a data local em BRT do timestamp UTC recebido
  // e reconstrói com remindTime explicitamente em BRT
  return fromBRT(dateBRT(firstRemindAt), remindTime);
}
