"use client";

import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { X, Clock, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";

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
  PENDING: "bg-yellow-400",
  CONFIRMED: "bg-green-500",
  CANCELLED: "bg-red-400",
  NO_SHOW: "bg-gray-400",
  DONE: "bg-blue-500",
};

export function DayEventsPopup({
  events,
  date,
  position,
  onClose,
  onSelectEvent,
}: Props) {
  return (
    <Popover open={true} onOpenChange={(open) => !open && onClose()}>
      {/* 
        Usamos o PopoverAnchor para posicionar o popup exatamente onde o clique ocorreu.
        O Shadcn Popover/Radix lidará com manter o popup dentro do viewport.
      */}
      <PopoverAnchor
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          width: 1,
          height: 1,
        }}
      />
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={12}
        className="w-[280px] p-0 overflow-hidden border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-999999"
        onInteractOutside={(e) => {
          // Mantém o comportamento de não fechar se o clique for no calendário de fundo
          // (opcional, dependendo de como o RBC lida com isso)
        }}
        // onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground mt-0.5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Event list */}
        <div
          className="overflow-y-auto scroll-cols-tracking max-h-72 py-2"
          onWheel={(e) => e.stopPropagation()}
        >
          {events.map((event) => (
            <button
              key={event.id}
              // onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEvent(event.id);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60 transition-colors text-left group"
            >
              {/* Colored dot */}
              <span
                className={cn(
                  "size-2.5 rounded-full shrink-0 mt-0.5",
                  statusColors[event.status] ?? "bg-primary",
                )}
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {event.title ?? "Agendamento"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="size-3 shrink-0" />
                  {dayjs(event.start).format("HH:mm")} –{" "}
                  {dayjs(event.end).format("HH:mm")}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 border-t border-border bg-muted/20">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="size-3" />
            {events.length} agendamento{events.length !== 1 ? "s" : ""} neste
            dia
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
