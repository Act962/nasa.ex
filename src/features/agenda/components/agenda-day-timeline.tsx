"use client";

import { useEffect, useMemo, useRef } from "react";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import { Briefcase, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaAppointment } from "./agenda-month-calendar";
import {
  formatShortMonth,
  formatShortWeekday,
  getAppointmentTitle,
  toSoftBackground,
  type WorkspaceCalendarEvent,
} from "../lib/mobile-calendar-events";

dayjs.locale("pt-br");

const FIRST_HOUR = 7;
const LAST_HOUR = 22;
const HOUR_HEIGHT_PX = 56;
const MIN_BLOCK_HEIGHT_PX = 24;
const DEFAULT_SCROLL_HOUR = 8;
const FALLBACK_COLOR = "#7c3aed";

const VISIBLE_HOURS = Array.from(
  { length: LAST_HOUR - FIRST_HOUR + 1 },
  (_, index) => FIRST_HOUR + index,
);
const TIMELINE_HEIGHT_PX = VISIBLE_HOURS.length * HOUR_HEIGHT_PX;

type TimelineItem =
  | { kind: "appointment"; id: string; startsAt: Dayjs; endsAt: Dayjs; appointment: AgendaAppointment }
  | { kind: "workspace"; id: string; startsAt: Dayjs; endsAt: Dayjs; event: WorkspaceCalendarEvent };

interface PositionedTimelineItem {
  item: TimelineItem;
  topPx: number;
  heightPx: number;
  lane: number;
  laneCount: number;
}

function toOffsetPx(date: Dayjs): number {
  const minutesFromStart = (date.hour() - FIRST_HOUR) * 60 + date.minute();
  const offsetPx = (minutesFromStart / 60) * HOUR_HEIGHT_PX;
  return Math.min(Math.max(offsetPx, 0), TIMELINE_HEIGHT_PX);
}

/** Distribui itens sobrepostos em colunas lado a lado, como no Google Agenda. */
function layoutTimelineItems(items: TimelineItem[]): PositionedTimelineItem[] {
  const sortedItems = [...items].sort(
    (first, second) => first.startsAt.valueOf() - second.startsAt.valueOf(),
  );
  const positionedItems: PositionedTimelineItem[] = [];
  let cluster: PositionedTimelineItem[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    for (const positioned of cluster) positioned.laneCount = laneEnds.length;
    positionedItems.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sortedItems) {
    const topPx = toOffsetPx(item.startsAt);
    const bottomPx = Math.max(toOffsetPx(item.endsAt), topPx + MIN_BLOCK_HEIGHT_PX);
    if (topPx >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= topPx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bottomPx);
    } else {
      laneEnds[lane] = bottomPx;
    }
    clusterEnd = cluster.length === 0 ? bottomPx : Math.max(clusterEnd, bottomPx);
    cluster.push({ item, topPx, heightPx: bottomPx - topPx, lane, laneCount: 1 });
  }
  closeCluster();
  return positionedItems;
}

interface AgendaDayTimelineProps {
  day: Dayjs;
  appointments: AgendaAppointment[];
  workspaceEvents: WorkspaceCalendarEvent[];
  agendaColorMap: Record<string, string>;
  selectedId: string | null;
  onBack: () => void;
  onSelectAppointment: (appointment: AgendaAppointment) => void;
  onSelectWorkspaceEvent: (event: WorkspaceCalendarEvent) => void;
  onCreateAt: (day: Dayjs, hour: number) => void;
}

export function AgendaDayTimeline({
  day,
  appointments,
  workspaceEvents,
  agendaColorMap,
  selectedId,
  onBack,
  onSelectAppointment,
  onSelectWorkspaceEvent,
  onCreateAt,
}: AgendaDayTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const allDayEvents = workspaceEvents.filter((event) => event.isAllDay);

  const positionedItems = useMemo(() => {
    const timedItems: TimelineItem[] = [
      ...appointments.map((appointment) => ({
        kind: "appointment" as const,
        id: appointment.id,
        startsAt: dayjs(appointment.startsAt),
        endsAt: dayjs(appointment.endsAt),
        appointment,
      })),
      ...workspaceEvents
        .filter((event) => !event.isAllDay)
        .map((event) => ({
          kind: "workspace" as const,
          id: event.id,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          event,
        })),
    ];
    return layoutTimelineItems(timedItems);
  }, [appointments, workspaceEvents]);

  const firstItemTopPx = positionedItems.length
    ? Math.min(...positionedItems.map((positioned) => positioned.topPx))
    : null;

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    const defaultTopPx = (DEFAULT_SCROLL_HOUR - FIRST_HOUR) * HOUR_HEIGHT_PX;
    const targetTopPx = firstItemTopPx ?? defaultTopPx;
    scrollContainer.scrollTo({ top: Math.max(0, targetTopPx - 8) });
  }, [day, firstItemTopPx]);

  const isToday = day.isSame(dayjs(), "day");
  const nowOffsetPx = isToday ? toOffsetPx(dayjs()) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para o mês"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-knob text-foreground transition active:scale-95"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h3 className={cn("text-lg font-bold", isToday && "text-info")}>
          {formatShortWeekday(day)}, {day.date()} {formatShortMonth(day)}
        </h3>
      </div>

      {allDayEvents.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {allDayEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelectWorkspaceEvent(event)}
              className="flex w-full items-center gap-1.5 rounded-[10px] bg-success/15 px-2.5 py-1.5 text-left text-xs font-medium text-success"
            >
              <Briefcase className="size-3.5 shrink-0" />
              <span className="truncate">{event.title}</span>
              <span className="ml-auto shrink-0 text-[10px] opacity-80">Dia inteiro</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-[18px] border border-line bg-card"
      >
        <div className="relative flex" style={{ height: TIMELINE_HEIGHT_PX }}>
          <div className="w-14 shrink-0">
            {VISIBLE_HOURS.map((hour) => (
              <div
                key={hour}
                className="pr-2 pt-1 text-right text-[10px] font-medium text-muted-foreground"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          <div className="relative flex-1 border-l border-line">
            {VISIBLE_HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                onClick={() => onCreateAt(day, hour)}
                aria-label={`Criar compromisso às ${String(hour).padStart(2, "0")}:00`}
                className="block w-full border-b border-line transition active:bg-muted"
                style={{ height: HOUR_HEIGHT_PX }}
              />
            ))}

            {nowOffsetPx !== null && nowOffsetPx > 0 && nowOffsetPx < TIMELINE_HEIGHT_PX && (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-info"
                style={{ top: nowOffsetPx }}
              >
                <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-info" />
              </div>
            )}

            {positionedItems.map(({ item, topPx, heightPx, lane, laneCount }) => {
              const widthPercent = 100 / laneCount;
              const blockStyle = {
                top: topPx + 1,
                height: heightPx - 2,
                left: `calc(${lane * widthPercent}% + 2px)`,
                width: `calc(${widthPercent}% - 4px)`,
              };
              const timeRange = `${item.startsAt.format("HH:mm")} – ${item.endsAt.format("HH:mm")}`;
              const isCompact = heightPx < 44;

              if (item.kind === "workspace") {
                return (
                  <button
                    key={`workspace-${item.id}`}
                    type="button"
                    onClick={() => onSelectWorkspaceEvent(item.event)}
                    className="absolute z-10 flex flex-col overflow-hidden rounded-[8px] border-l-[3px] border-success bg-success/15 px-1.5 py-0.5 text-left text-success"
                    style={blockStyle}
                  >
                    <span className="flex items-center gap-1 truncate text-[11px] font-semibold leading-tight">
                      <Briefcase className="size-3 shrink-0" />
                      <span className="truncate">{item.event.title}</span>
                    </span>
                    {!isCompact && (
                      <span className="truncate text-[10px] opacity-80">
                        {item.event.workspaceName ? `${item.event.workspaceName} · ` : ""}
                        {timeRange}
                      </span>
                    )}
                  </button>
                );
              }

              const agendaColor = agendaColorMap[item.appointment.agendaId] ?? FALLBACK_COLOR;
              const isCancelled = item.appointment.status === "CANCELLED";
              return (
                <button
                  key={`appointment-${item.id}`}
                  type="button"
                  onClick={() => onSelectAppointment(item.appointment)}
                  className={cn(
                    "absolute z-10 flex flex-col overflow-hidden rounded-[8px] border-l-[3px] px-1.5 py-0.5 text-left",
                    selectedId === item.id && "ring-2 ring-info",
                    isCancelled && "opacity-50",
                  )}
                  style={{
                    ...blockStyle,
                    backgroundColor: toSoftBackground(agendaColor),
                    borderLeftColor: agendaColor,
                    color: agendaColor,
                  }}
                >
                  <span
                    className={cn(
                      "truncate text-[11px] font-semibold leading-tight",
                      isCancelled && "line-through",
                    )}
                  >
                    {getAppointmentTitle(item.appointment)}
                  </span>
                  {!isCompact && item.appointment.lead?.name && (
                    <span className="truncate text-[10px] text-foreground/80">
                      {item.appointment.lead.name}
                    </span>
                  )}
                  {!isCompact && (
                    <span className="truncate text-[10px] opacity-80">{timeRange}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
