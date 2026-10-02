"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useWorkspaceCalendar } from "@/features/actions/hooks/use-tasks";
import type { AgendaAppointment } from "./agenda-month-calendar";
import { AgendaDayTimeline } from "./agenda-day-timeline";
import {
  DAY_KEY_FORMAT,
  formatShortMonth,
  getAppointmentTitle,
  groupByDay,
  toDayKey,
  toSoftBackground,
  toWorkspaceCalendarEvents,
  type WorkspaceCalendarEvent,
} from "../lib/mobile-calendar-events";

dayjs.locale("pt-br");

// Mesma ordem do grid desktop (domingo primeiro).
const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];
const UPCOMING_MONTHS_COUNT = 6;
const MAX_CHIPS_PER_CELL = 3;
const FALLBACK_COLOR = "#7c3aed";

type CalendarChip =
  | { kind: "appointment"; id: string; label: string; color: string; isCancelled: boolean }
  | { kind: "workspace"; id: string; label: string };

interface AgendaMobileCalendarProps {
  cursor: Dayjs;
  onCursorChange: (month: Dayjs) => void;
  appointments: AgendaAppointment[];
  agendaColorMap: Record<string, string>;
  selectedId: string | null;
  isLoading?: boolean;
  onSelectAppointment: (appointment: AgendaAppointment) => void;
  onCreateForDate: (day: Dayjs, hour?: number) => void;
}

export function AgendaMobileCalendar({
  cursor,
  onCursorChange,
  appointments,
  agendaColorMap,
  selectedId,
  isLoading,
  onSelectAppointment,
  onCreateForDate,
}: AgendaMobileCalendarProps) {
  const router = useRouter();
  const [openDay, setOpenDay] = useState<Dayjs | null>(null);
  const activeMonthPillRef = useRef<HTMLButtonElement>(null);

  const gridDays = useMemo(() => {
    const startOfMonth = cursor.startOf("month");
    const firstGridDay = startOfMonth.subtract(startOfMonth.day(), "day");
    const weeksCount = Math.ceil((startOfMonth.day() + cursor.daysInMonth()) / 7);
    return Array.from({ length: weeksCount * 7 }, (_, index) =>
      firstGridDay.add(index, "day"),
    );
  }, [cursor]);

  const monthPills = useMemo(() => {
    const currentMonth = dayjs().startOf("month");
    const firstPillMonth = cursor.isBefore(currentMonth) ? cursor : currentMonth;
    return Array.from({ length: UPCOMING_MONTHS_COUNT }, (_, index) =>
      firstPillMonth.add(index, "month"),
    );
  }, [cursor]);

  const { actions, isLoading: isLoadingWorkspace } = useWorkspaceCalendar({
    startDate: gridDays[0].format(DAY_KEY_FORMAT),
    endDate: gridDays[gridDays.length - 1].format(DAY_KEY_FORMAT),
  });

  const workspaceEventsByDay = useMemo(
    () => groupByDay(toWorkspaceCalendarEvents(actions), (event) => event.startsAt),
    [actions],
  );

  const appointmentsByDay = useMemo(
    () => groupByDay(appointments, (appointment) => appointment.startsAt),
    [appointments],
  );

  useEffect(() => {
    activeMonthPillRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [cursor]);

  const openWorkspaceEvent = (event: WorkspaceCalendarEvent) => {
    router.push(`/workspaces/${event.workspaceId}?actionId=${event.id}`);
  };

  const buildChips = (dayKey: string): CalendarChip[] => [
    ...(appointmentsByDay.get(dayKey) ?? []).map((appointment) => ({
      kind: "appointment" as const,
      id: appointment.id,
      label: getAppointmentTitle(appointment),
      color: agendaColorMap[appointment.agendaId] ?? FALLBACK_COLOR,
      isCancelled: appointment.status === "CANCELLED",
    })),
    ...(workspaceEventsByDay.get(dayKey) ?? []).map((event) => ({
      kind: "workspace" as const,
      id: event.id,
      label: event.title,
    })),
  ];

  if (openDay) {
    const openDayKey = toDayKey(openDay);
    return (
      <AgendaDayTimeline
        day={openDay}
        appointments={appointmentsByDay.get(openDayKey) ?? []}
        workspaceEvents={workspaceEventsByDay.get(openDayKey) ?? []}
        agendaColorMap={agendaColorMap}
        selectedId={selectedId}
        onBack={() => setOpenDay(null)}
        onSelectAppointment={onSelectAppointment}
        onSelectWorkspaceEvent={openWorkspaceEvent}
        onCreateAt={onCreateForDate}
      />
    );
  }

  const today = dayjs();
  const isFetching = isLoading || isLoadingWorkspace;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="scroll-hidden-x flex gap-2 overflow-x-auto pb-1">
        {monthPills.map((month, index) => {
          const isActive = month.isSame(cursor, "month");
          const previousMonth = monthPills[index - 1];
          const isNewYear = !previousMonth || previousMonth.year() !== month.year();
          return (
            <button
              key={month.format("YYYY-MM")}
              ref={isActive ? activeMonthPillRef : undefined}
              type="button"
              onClick={() => onCursorChange(month)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1 rounded-full px-4 text-sm font-semibold transition",
                isActive ? "bg-info/15 text-info" : "bg-muted text-muted-foreground",
              )}
            >
              {formatShortMonth(month)}
              {isNewYear && (
                <span className="text-xs font-normal opacity-70">{month.year()}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto rounded-[18px] border border-line bg-card">
        <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-line bg-card">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <div
              key={index}
              className="py-2 text-center text-[11px] font-semibold text-muted-foreground"
            >
              {initial}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {gridDays.map((day, index) => {
            const dayKey = toDayKey(day);
            const chips = buildChips(dayKey);
            const hiddenChipsCount = chips.length - MAX_CHIPS_PER_CELL;
            const isOutsideMonth = !day.isSame(cursor, "month");
            const isToday = day.isSame(today, "day");
            const isLastColumn = index % 7 === 6;
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => setOpenDay(day)}
                aria-label={`Ver ${day.format("D [de] MMMM")}`}
                className={cn(
                  "flex min-h-[84px] min-w-0 flex-col items-stretch gap-0.5 border-b border-line p-0.5 text-left transition active:bg-muted",
                  !isLastColumn && "border-r",
                  isOutsideMonth && "bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday && "bg-info text-white",
                    !isToday && isOutsideMonth && "text-muted-foreground/60",
                  )}
                >
                  {day.date()}
                </span>
                {chips.slice(0, MAX_CHIPS_PER_CELL).map((chip) =>
                  chip.kind === "workspace" ? (
                    <span
                      key={`workspace-${chip.id}`}
                      className="flex items-center gap-0.5 truncate rounded-[4px] bg-success/15 px-1 py-px text-[10px] font-medium leading-tight text-success"
                    >
                      <Briefcase className="size-2.5 shrink-0" />
                      <span className="truncate">{chip.label}</span>
                    </span>
                  ) : (
                    <span
                      key={`appointment-${chip.id}`}
                      className={cn(
                        "truncate rounded-[4px] px-1 py-px text-[10px] font-medium leading-tight",
                        chip.isCancelled && "line-through opacity-60",
                        selectedId === chip.id && "ring-1 ring-info",
                      )}
                      style={{ backgroundColor: toSoftBackground(chip.color), color: chip.color }}
                    >
                      {chip.label}
                    </span>
                  ),
                )}
                {hiddenChipsCount > 0 && (
                  <span className="px-1 text-[10px] font-semibold text-muted-foreground">
                    +{hiddenChipsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isFetching && (
          <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
            <OrbitaSpinner className="size-6" />
          </div>
        )}
      </div>
    </div>
  );
}
