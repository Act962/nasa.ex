"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { X, Clock, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  start: Date;
  end: Date;
  title: string | null | undefined;
  id: string;
  status: string;
}

interface Props {
  events: CalendarEvent[];
  date: Date;
  position: { x: number; y: number };
  onClose: () => void;
  onSelectEvent: (id: string) => void;
}

const statusColors: Record<string, string> = {
  PENDING:   "bg-yellow-400",
  CONFIRMED: "bg-green-500",
  CANCELLED: "bg-red-400",
  NO_SHOW:   "bg-gray-400",
  DONE:      "bg-blue-500",
};

export function DayEventsPopup({ events, date, position, onClose, onSelectEvent }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay so the triggering click doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Position popup: keep it within viewport
  const POPUP_W = 280;
  const POPUP_MAX_H = 400;
  const MARGIN = 12;

  const vw = typeof window !== "undefined" ? window.innerWidth  : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;

  let left = position.x + MARGIN;
  let top  = position.y + MARGIN;

  if (left + POPUP_W > vw - MARGIN) left = position.x - POPUP_W - MARGIN;
  if (top + POPUP_MAX_H > vh - MARGIN) top = vh - POPUP_MAX_H - MARGIN;
  if (left < MARGIN) left = MARGIN;
  if (top  < MARGIN) top  = MARGIN;

  const popup = (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, width: POPUP_W, zIndex: 9999 }}
      className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header — day */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 bg-muted/30 border-b border-border">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            {dayjs(date).locale("pt-br").format("ddd")}
          </p>
          <p className="text-3xl font-light leading-none mt-0.5 text-foreground">
            {dayjs(date).format("D")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground mt-0.5"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Event list */}
      <div className="overflow-y-auto max-h-72 py-2">
        {events.map((event) => (
          <button
            key={event.id}
            onClick={() => { onSelectEvent(event.id); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60 transition-colors text-left group"
          >
            {/* Colored dot */}
            <span className={cn(
              "size-2.5 rounded-full flex-shrink-0 mt-0.5",
              statusColors[event.status] ?? "bg-primary",
            )} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {event.title ?? "Agendamento"}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="size-3 flex-shrink-0" />
                {dayjs(event.start).format("HH:mm")} – {dayjs(event.end).format("HH:mm")}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-border bg-muted/20">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <CalendarIcon className="size-3" />
          {events.length} agendamento{events.length !== 1 ? "s" : ""} neste dia
        </p>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(popup, document.body);
}
