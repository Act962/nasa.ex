"use client";

import { useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Calendar, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORIES } from "../utils/categories";
import { imgSrc } from "../utils/img-src";
import type { PublicEvent } from "../types";

dayjs.locale("pt-br");

function EventListCard({
  event,
  selected,
  onSelect,
}: {
  event: PublicEvent;
  selected: boolean;
  onSelect: (e: PublicEvent) => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const cat = event.eventCategory
    ? EVENT_CATEGORIES.find((c) => c.value === event.eventCategory)
    : null;

  const coverSrc = event.coverImage && !coverFailed ? imgSrc(event.coverImage) : null;
  const logoSrc =
    event.organization?.logo && !logoFailed
      ? imgSrc(event.organization.logo)
      : null;

  const start = event.startDate ? dayjs(event.startDate) : null;
  const end = event.endDate ? dayjs(event.endDate) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        "group flex w-full gap-3 rounded-xl border p-3 text-left transition",
        selected
          ? "border-primary/50 bg-primary/10"
          : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/40",
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt={event.title}
            className="h-full w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        ) : logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={event.organization?.name ?? ""}
            className="h-full w-full object-contain bg-card p-1"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 text-2xl">
            {cat?.emoji ?? "✨"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        {start && (
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-primary">
            <Calendar className="h-2.5 w-2.5" />
            <span className="capitalize">{start.format("DD MMM YYYY")}</span>
          </div>
        )}
        <div className="truncate text-sm font-semibold leading-tight">
          {event.title}
        </div>
        {start && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span>
              {start.format("HH:mm")}
              {end ? ` - ${end.format("HH:mm")}` : ""}
            </span>
          </div>
        )}
        {(event.city || event.state) && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {[event.city, event.state].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

interface EventListPanelProps {
  events: PublicEvent[];
  selectedId?: string | null;
  onSelect: (event: PublicEvent) => void;
}

export function EventListPanel({ events, selectedId, onSelect }: EventListPanelProps) {
  const sorted = [...events].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-4 py-3">
        <h3 className="font-semibold">Lista de Eventos</h3>
        <p className="text-xs text-muted-foreground">
          {events.length} evento{events.length === 1 ? "" : "s"} público{events.length === 1 ? "" : "s"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Nenhum evento encontrado.
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-auto p-3">
          {sorted.map((ev) => (
            <EventListCard
              key={ev.id}
              event={ev}
              selected={selectedId === ev.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
