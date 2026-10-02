// Normaliza agendamentos e ações de workspace para a visão Calendário do celular.
import dayjs, { type Dayjs } from "dayjs";
import type { AgendaAppointment } from "../components/agenda-month-calendar";

export interface WorkspaceCalendarActionInput {
  id: string;
  title: string;
  workspaceId: string;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  endDate?: Date | string | null;
  workspace?: { name: string } | null;
}

export interface WorkspaceCalendarEvent {
  id: string;
  workspaceId: string;
  title: string;
  workspaceName: string | null;
  startsAt: Dayjs;
  endsAt: Dayjs;
  isAllDay: boolean;
}

export const DAY_KEY_FORMAT = "YYYY-MM-DD";
const DEFAULT_EVENT_DURATION_MINUTES = 60;

export function toDayKey(date: Dayjs | Date | string): string {
  return dayjs(date).format(DAY_KEY_FORMAT);
}

function isMidnight(date: Dayjs): boolean {
  return date.hour() === 0 && date.minute() === 0;
}

export function toWorkspaceCalendarEvents(
  actions: WorkspaceCalendarActionInput[],
): WorkspaceCalendarEvent[] {
  const events: WorkspaceCalendarEvent[] = [];
  for (const action of actions) {
    const rawStart = action.startDate ?? action.dueDate;
    if (!rawStart) continue;
    const startsAt = dayjs(rawStart);
    const rawEnd =
      action.endDate ?? (action.startDate && action.dueDate ? action.dueDate : null);
    const parsedEnd = rawEnd ? dayjs(rawEnd) : null;
    const hasSameDayEnd =
      parsedEnd !== null &&
      parsedEnd.isAfter(startsAt) &&
      parsedEnd.isSame(startsAt, "day");
    events.push({
      id: action.id,
      workspaceId: action.workspaceId,
      title: action.title,
      workspaceName: action.workspace?.name ?? null,
      startsAt,
      endsAt: hasSameDayEnd
        ? parsedEnd
        : startsAt.add(DEFAULT_EVENT_DURATION_MINUTES, "minute"),
      // Prazo salvo à meia-noite = data sem horário; vai para a faixa "dia inteiro".
      isAllDay: isMidnight(startsAt) && (!hasSameDayEnd || isMidnight(parsedEnd)),
    });
  }
  return events;
}

export function groupByDay<TItem>(
  items: TItem[],
  getStart: (item: TItem) => Dayjs | Date | string,
): Map<string, TItem[]> {
  const itemsByDay = new Map<string, TItem[]>();
  for (const item of items) {
    const dayKey = toDayKey(getStart(item));
    const dayItems = itemsByDay.get(dayKey) ?? [];
    dayItems.push(item);
    itemsByDay.set(dayKey, dayItems);
  }
  for (const dayItems of itemsByDay.values()) {
    dayItems.sort(
      (first, second) =>
        dayjs(getStart(first)).valueOf() - dayjs(getStart(second)).valueOf(),
    );
  }
  return itemsByDay;
}

export function getAppointmentTitle(appointment: AgendaAppointment): string {
  return (
    (appointment.title ?? "").replace(/^agendamento:\s*/i, "").trim() ||
    appointment.lead?.name ||
    "Agendamento"
  );
}

/** `${cor}26` = cor da agenda com ~15% de opacidade (fundo suave). */
export function toSoftBackground(hexColor: string): string {
  return `${hexColor}26`;
}

/** pt-br do dayjs não traz o ponto da abreviação ("qui", "out"). */
export function formatShortWeekday(date: Dayjs): string {
  return `${date.format("ddd")}.`;
}

export function formatShortMonth(date: Dayjs): string {
  const monthLabel = date.format("MMM");
  return monthLabel.endsWith(".") ? monthLabel : `${monthLabel}.`;
}
