"use client";

import { useEffect, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { addDays, format, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { CalendarPostChip } from "./calendar-post-chip";
import { WeekdayThemeChip } from "./weekday-theme-chip";
import { BroadcastChip, broadcastDate, type CalendarBroadcast } from "./broadcast-chip";
import { postDate } from "./planner-v2-utils";
import type { CalendarPost, CalendarSlot, PlannerClient } from "./planner-v2-types";

/** Semana em horas (spec 0058, RF-6): posts por horário, horários sugeridos tracejados e linha do agora. */

const FIRST_HOUR = 6;
const LAST_HOUR = 23;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => FIRST_HOUR + index);
const NOW_REFRESH_MS = 60_000;

interface WeekViewProps {
  weekStart: Date;
  posts: CalendarPost[];
  broadcasts: CalendarBroadcast[];
  slots: CalendarSlot[];
  clients: PlannerClient[];
  /** Cliente cujos temas do dia aparecem no cabeçalho; null com vários clientes no filtro. */
  themeClient: PlannerClient | null;
  weekdayThemes: Array<{ organizationId: string; weekday: number; theme: string }>;
  onOpenPost: (postId: string) => void;
  onRetryPost: (postId: string) => void;
  onUseSlot: (slot: CalendarSlot) => void;
}

function hourOf(date: Date) {
  return Math.min(Math.max(date.getHours(), FIRST_HOUR), LAST_HOUR);
}

function HourCell({ day, hour, children }: { day: Date; hour: number; children: React.ReactNode }) {
  const cellDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${cellDate.toISOString()}`, data: { date: cellDate.toISOString() } });
  return (
    <div ref={setNodeRef} className={cn("relative min-h-16 space-y-1 border-t border-l border-line p-1", isOver && "bg-info/10")}>
      {children}
    </div>
  );
}

export function WeekView({ weekStart, posts, broadcasts, slots, clients, themeClient, weekdayThemes, onOpenPost, onRetryPost, onUseSlot }: WeekViewProps) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const clientIndexById = useMemo(() => new Map(clients.map((client, index) => [client.id, index] as const)), [clients]);

  return (
    <div className="scroll-hidden-x overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-[52px_repeat(7,minmax(0,1fr))]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-l border-line px-1 py-2 text-center text-xs text-muted-foreground">
            {themeClient && (
              <WeekdayThemeChip
                organizationId={themeClient.id}
                weekday={day.getDay()}
                theme={weekdayThemes.find((candidate) => candidate.organizationId === themeClient.id && candidate.weekday === day.getDay())?.theme ?? null}
                canEdit={themeClient.permissions.canCreate}
                isFirst={day.getDay() === 0}
              />
            )}
            <span className="capitalize">{format(day, "EEE", { locale: ptBR })}</span>
            <span
              className={cn(
                "mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-base font-bold text-foreground",
                isToday(day) && "bg-foreground text-background",
              )}
            >
              {format(day, "d")}
            </span>
          </div>
        ))}

        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-t border-line pt-1 pr-2 text-right text-[11px] text-muted-foreground">{String(hour).padStart(2, "0")}:00</div>
            {days.map((day) => {
              const cellPosts = posts.filter((post) => {
                const date = postDate(post);
                return date && isSameDay(date, day) && hourOf(date) === hour;
              });
              const cellBroadcasts = broadcasts.filter((broadcast) => {
                const date = broadcastDate(broadcast);
                return date && isSameDay(date, day) && hourOf(date) === hour;
              });
              const cellSlot = slots.find((slot) => {
                const slotDate = new Date(slot.startsAt);
                return isSameDay(slotDate, day) && slotDate.getHours() === hour;
              });
              const isNowRow = isToday(day) && now.getHours() === hour;
              return (
                <HourCell key={`${day.toISOString()}-${hour}`} day={day} hour={hour}>
                  {isNowRow && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive before:absolute before:-top-[3px] before:-left-1 before:size-2 before:rounded-full before:bg-destructive"
                      style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                    />
                  )}
                  {cellPosts.map((post) => (
                    <CalendarPostChip
                      key={post.id}
                      post={post}
                      client={clients.find((client) => client.id === post.organizationId)}
                      clientIndex={clientIndexById.get(post.organizationId) ?? 0}
                      onOpen={onOpenPost}
                      onRetry={onRetryPost}
                    />
                  ))}
                  {cellBroadcasts.map((broadcast) => <BroadcastChip key={broadcast.id} broadcast={broadcast} />)}
                  {cellSlot && cellPosts.length === 0 && cellBroadcasts.length === 0 && (
                    <div className="flex h-full min-h-14 flex-col justify-between rounded-[14px] border-[1.5px] border-dashed border-line p-1.5 text-[10.5px] leading-tight text-muted-foreground">
                      <span>{cellSlot.label}</span>
                      <button
                        type="button"
                        data-guide={GUIDE_ANCHORS.plannerBestTimeSlot.id}
                        onClick={() => onUseSlot(cellSlot)}
                        className="self-start rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background"
                      >
                        Programar
                      </button>
                    </div>
                  )}
                </HourCell>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
