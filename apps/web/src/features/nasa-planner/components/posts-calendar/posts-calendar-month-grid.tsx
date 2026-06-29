"use client";

import { useState, useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { PostsCalendarPostCard } from "./posts-calendar-post-card";
import type { MenuAction } from "./types";

dayjs.locale("pt-br");

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_VISIBLE = 3;
const CARD_HEIGHT = 52;
const CARD_GAP = 4;
const CELL_PADDING = 5;
const PLUS_HEIGHT = 22;
const EMPTY_ROW_HEIGHT = 52;

interface Post {
  id: string;
  title: string | null;
  thumbnail: string | null;
  status: string;
  targetNetworks: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  type?: string | null;
  videoKey?: string | null;
  metricsReach?: number | null;
  metricsLikes?: number | null;
}

interface Props {
  posts: Post[];
  cursor: Dayjs;
  onCursorChange: (c: Dayjs) => void;
  onSelect: (post: Post) => void;
  onReschedule: (postId: string, newDate: Date) => void;
  selectedId?: string | null;
  onMenuAction?: (postId: string, action: MenuAction) => void;
}

function DraggableCard({ post, selected, onSelect, onMenuAction }: {
  post: Post;
  selected: boolean;
  onSelect: (p: Post) => void;
  onMenuAction?: (postId: string, action: MenuAction) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <PostsCalendarPostCard post={post} selected={selected} onSelect={onSelect} onMenuAction={onMenuAction} />
    </div>
  );
}

function DroppableCell({ dayKey, children }: { dayKey: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  return (
    <div
      ref={setNodeRef}
      className={cn("h-full w-full", isOver && "ring-2 ring-inset ring-violet-400 rounded-lg")}
    >
      {children}
    </div>
  );
}

export function PostsCalendarMonthGrid({ posts, cursor, onCursorChange, onSelect, onReschedule, selectedId, onMenuAction }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const dateStr = p.scheduledAt ?? p.publishedAt;
      if (!dateStr) continue;
      const key = dayjs(dateStr).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [posts]);

  const grid = useMemo(() => {
    const start = cursor.startOf("month");
    const first = start.subtract(start.day(), "day");
    const days: Dayjs[] = [];
    for (let i = 0; i < 42; i++) days.push(first.add(i, "day"));
    return days;
  }, [cursor]);

  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    for (let i = 0; i < grid.length; i += 7) {
      const row = grid.slice(i, i + 7);
      let max = 0;
      let hasOverflow = false;
      for (const day of row) {
        const count = postsByDay.get(day.format("YYYY-MM-DD"))?.length ?? 0;
        max = Math.max(max, Math.min(count, MAX_VISIBLE));
        if (count > MAX_VISIBLE) hasOverflow = true;
      }
      if (max === 0) { heights.push(EMPTY_ROW_HEIGHT); continue; }
      const base = 2 * CELL_PADDING + max * CARD_HEIGHT + (max - 1) * CARD_GAP;
      heights.push(hasOverflow ? base + CARD_GAP + PLUS_HEIGHT : base);
    }
    return heights;
  }, [grid, postsByDay]);

  const today = dayjs().startOf("day");

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const dayKey = over.id as string;
    const newDate = dayjs(dayKey).hour(9).minute(0).second(0).toDate();
    onReschedule(active.id as string, newDate);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-xl font-bold capitalize">
            <span>{cursor.format("MMMM")}</span>
            <span className="ml-2 font-normal text-muted-foreground">{cursor.format("YYYY")}</span>
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onCursorChange(dayjs().startOf("month"))}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCursorChange(cursor.subtract(1, "month"))}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCursorChange(cursor.add(1, "month"))}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 px-3">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          className="grid flex-1 grid-cols-7 gap-1 overflow-auto px-3 pb-3"
          style={{ gridTemplateRows: rowHeights.map((h) => `${h}px`).join(" "), alignContent: "start" }}
        >
          {grid.map((day) => {
            const dayKey = day.format("YYYY-MM-DD");
            const dayPosts = postsByDay.get(dayKey) ?? [];
            const isOutside = !day.isSame(cursor, "month");
            const isToday = day.isSame(today, "day");
            const overflow = dayPosts.length - MAX_VISIBLE;

            return (
              <DroppableCell key={dayKey} dayKey={dayKey}>
                <div
                  className={cn(
                    "relative overflow-hidden rounded-lg h-full",
                    isToday ? "bg-primary/15 ring-1 ring-primary/40" : isOutside ? "bg-muted/30" : "bg-card/60",
                  )}
                  style={{ padding: CELL_PADDING }}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute left-[5px] top-[5px] z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isToday && "bg-primary text-primary-foreground",
                      isOutside && !isToday && "text-muted-foreground/40",
                      !isToday && !isOutside && "bg-background/85 text-foreground/90",
                    )}
                  >
                    {day.date()}
                  </div>

                  {dayPosts.length > 0 && (
                    <div className="flex h-full flex-col" style={{ gap: CARD_GAP }}>
                      {dayPosts.slice(0, MAX_VISIBLE).map((p) => (
                        <DraggableCard key={p.id} post={p} selected={selectedId === p.id} onSelect={onSelect} onMenuAction={onMenuAction} />
                      ))}
                      {overflow > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              style={{ height: PLUS_HEIGHT }}
                              className="w-full shrink-0 rounded bg-muted/50 px-2 text-[11px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              +{overflow} mais
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-52 p-1" align="start">
                            <div className="flex flex-col gap-0.5">
                              {dayPosts.slice(MAX_VISIBLE).map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => onSelect(p)}
                                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted transition-colors"
                                >
                                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: "#7c3aed" }} />
                                  <span className="truncate">{p.title ?? "Post"}</span>
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )}
                </div>
              </DroppableCell>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
