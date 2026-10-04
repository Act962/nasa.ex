"use client";

import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPostChip } from "./calendar-post-chip";
import { postDate } from "./planner-v2-utils";
import type { CalendarPost, CalendarSlot, PlannerClient } from "./planner-v2-types";

/** Celular (spec 0058, RF-14): o calendário vira agenda em cartões, agrupada por dia. */
export function MobileAgenda({
  posts,
  slots,
  clients,
  onOpenPost,
  onRetryPost,
  onUseSlot,
}: {
  posts: CalendarPost[];
  slots: CalendarSlot[];
  clients: PlannerClient[];
  onOpenPost: (postId: string) => void;
  onRetryPost: (postId: string) => void;
  onUseSlot: (slot: CalendarSlot) => void;
}) {
  const days = useMemo(() => {
    const dayKeys = new Map<string, Date>();
    for (const post of posts) {
      const date = postDate(post);
      if (date) dayKeys.set(format(date, "yyyy-MM-dd"), date);
    }
    for (const slot of slots.slice(0, 5)) dayKeys.set(format(new Date(slot.startsAt), "yyyy-MM-dd"), new Date(slot.startsAt));
    return [...dayKeys.values()].sort((left, right) => left.getTime() - right.getTime());
  }, [posts, slots]);

  if (days.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Nada planejado neste período.</p>;

  return (
    <div className="space-y-4 p-3">
      {days.map((day) => {
        const dayPosts = posts.filter((post) => {
          const date = postDate(post);
          return date && isSameDay(date, day);
        });
        const daySlots = dayPosts.length === 0 ? slots.filter((slot) => isSameDay(new Date(slot.startsAt), day)).slice(0, 1) : [];
        return (
          <section key={day.toISOString()}>
            <p className="mb-2 text-sm font-bold capitalize">{format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
            <div className="space-y-1.5">
              {dayPosts.map((post) => {
                const clientIndex = clients.findIndex((client) => client.id === post.organizationId);
                return (
                  <CalendarPostChip key={post.id} post={post} client={clients[clientIndex]} clientIndex={Math.max(clientIndex, 0)} onOpen={onOpenPost} onRetry={onRetryPost} />
                );
              })}
              {daySlots.map((slot) => (
                <button
                  key={new Date(slot.startsAt).toISOString()}
                  type="button"
                  onClick={() => onUseSlot(slot)}
                  className="flex w-full items-center justify-between rounded-[14px] border-[1.5px] border-dashed border-line px-3 py-2 text-left text-xs text-muted-foreground"
                >
                  {format(new Date(slot.startsAt), "HH:mm")} · {slot.label}
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">Programar</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
