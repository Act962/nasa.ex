"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { addDays, differenceInCalendarDays, format, isSameDay, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarPostChip } from "./calendar-post-chip";
import { BroadcastChip, broadcastDate, type CalendarBroadcast } from "./broadcast-chip";
import { postDate } from "./planner-v2-utils";
import type { CalendarPost, PlannerClient } from "./planner-v2-types";

/** Mês em grade (spec 0058, RF-6): até três posts por dia e o restante em "+N". */

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_CHIPS_PER_DAY = 3;

function DayCell({ day, isCurrentMonth, children, onShowDay }: { day: Date; isCurrentMonth: boolean; children: React.ReactNode; onShowDay: (day: Date) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.toISOString()}`, data: { date: day.toISOString(), keepTime: true } });
  return (
    <div ref={setNodeRef} className={cn("min-h-28 space-y-1 border-t border-l border-line p-1", !isCurrentMonth && "opacity-50", isOver && "bg-info/10")}>
      <button
        type="button"
        onClick={() => onShowDay(day)}
        className={cn(
          "grid size-6 place-items-center rounded-full text-xs font-semibold text-foreground hover:bg-panel",
          isToday(day) && "bg-foreground text-background hover:bg-foreground",
        )}
      >
        {format(day, "d")}
      </button>
      {children}
    </div>
  );
}

export function MonthView({
  rangeStart,
  rangeEnd,
  anchorDate,
  posts,
  broadcasts,
  clients,
  onOpenPost,
  onRetryPost,
  onShowDay,
}: {
  rangeStart: Date;
  rangeEnd: Date;
  anchorDate: Date;
  posts: CalendarPost[];
  broadcasts: CalendarBroadcast[];
  clients: PlannerClient[];
  onOpenPost: (postId: string) => void;
  onRetryPost: (postId: string) => void;
  onShowDay: (day: Date) => void;
}) {
  const days = useMemo(
    () => Array.from({ length: differenceInCalendarDays(rangeEnd, rangeStart) }, (_, index) => addDays(rangeStart, index)),
    [rangeStart, rangeEnd],
  );
  const clientIndexById = useMemo(() => new Map(clients.map((client, index) => [client.id, index] as const)), [clients]);

  return (
    <div className="scroll-hidden-x overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs text-muted-foreground">{label}</div>
        ))}
        {days.map((day) => {
          const dayPosts = posts.filter((post) => {
            const date = postDate(post);
            return date && isSameDay(date, day);
          });
          const dayBroadcasts = broadcasts.filter((broadcast) => {
            const date = broadcastDate(broadcast);
            return date && isSameDay(date, day);
          });
          return (
            <DayCell key={day.toISOString()} day={day} isCurrentMonth={isSameMonth(day, anchorDate)} onShowDay={onShowDay}>
              {dayPosts.slice(0, MAX_CHIPS_PER_DAY).map((post) => (
                <CalendarPostChip
                  key={post.id}
                  post={post}
                  client={clients.find((client) => client.id === post.organizationId)}
                  clientIndex={clientIndexById.get(post.organizationId) ?? 0}
                  isCompact
                  onOpen={onOpenPost}
                  onRetry={onRetryPost}
                />
              ))}
              {dayBroadcasts.map((broadcast) => <BroadcastChip key={broadcast.id} broadcast={broadcast} isCompact />)}
              {dayPosts.length > MAX_CHIPS_PER_DAY && (
                <button type="button" onClick={() => onShowDay(day)} className="px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  +{dayPosts.length - MAX_CHIPS_PER_DAY} posts
                </button>
              )}
            </DayCell>
          );
        })}
      </div>
    </div>
  );
}
