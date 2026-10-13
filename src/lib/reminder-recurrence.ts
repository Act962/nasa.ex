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

/** Número de dias do mês (1-based). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Avança uma data "YYYY-MM-DD" por N dias. */
function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return dateInMonth(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/**
 * Data "YYYY-MM-DD" no mês pedido, com o dia limitado ao último dia do mês.
 * Limitar aqui, e não depois de montar a data, é o que impede o dia 31 de
 * transbordar para o mês seguinte (spec 0105).
 */
function dateInMonth(year: number, month: number, anchorDay: number): string {
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Mesma data de referência, um mês depois de `localDate`. */
function sameDayNextMonth(localDate: string, anchorDay: number): string {
  const [year, month] = localDate.split("-").map(Number);
  return month === 12
    ? dateInMonth(year + 1, 1, anchorDay)
    : dateInMonth(year, month + 1, anchorDay);
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
      const anchorDay = dayOfMonth ?? Number(localDate.split("-")[2]);
      return fromBRT(sameDayNextMonth(localDate, anchorDay), localTime);
    }
  }
}

/**
 * Dia de referência a gravar em `Reminder.dayOfMonth`.
 *
 * Mensal sem dia fixo guarda o dia da data de início: sem isso, depois de um
 * mês curto o lembrete de dia 31 ficaria no dia 28 para sempre (spec 0105).
 */
export function resolveMonthlyAnchorDay(
  recurrenceType: ReminderRecurrenceType,
  dayOfMonth: number | undefined,
  firstRemindAt: Date,
): number | null {
  if (dayOfMonth !== undefined) return dayOfMonth;
  if (recurrenceType !== ReminderRecurrenceType.MONTHLY) return null;
  return Number(dateBRT(firstRemindAt).split("-")[2]);
}

/**
 * Calcula a primeira data de disparo interpretando horários como BRT (UTC-3).
 *
 * - Se `dayOfMonth` for fornecido (MONTHLY com dia fixo):
 *   agenda neste mês se o dia ainda não passou, senão no seguinte; em mês que
 *   não tem o dia, usa o último dia do mês.
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
    const [currentYear, currentMonth] = dateBRT(new Date()).split("-").map(Number);
    const currentMonthDate = dateInMonth(currentYear, currentMonth, dayOfMonth);
    const candidate = fromBRT(currentMonthDate, remindTime);
    if (candidate > new Date()) return candidate;
    return fromBRT(sameDayNextMonth(currentMonthDate, dayOfMonth), remindTime);
  }

  if (!firstRemindAt) {
    throw new Error("firstRemindAt é obrigatório quando dayOfMonth não é informado");
  }

  // Extrai a data local em BRT do timestamp UTC recebido
  // e reconstrói com remindTime explicitamente em BRT
  return fromBRT(dateBRT(firstRemindAt), remindTime);
}
