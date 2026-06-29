"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORIES } from "../utils/categories";
import { imgSrc } from "../utils/img-src";
import type { PublicEvent } from "../types";

interface EventCardProps {
  event: PublicEvent;
  onClick?: () => void;
  compact?: boolean;
}

export function EventCard({ event, onClick, compact }: EventCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const category = event.eventCategory
    ? EVENT_CATEGORIES.find((c) => c.value === event.eventCategory)
    : null;

  const start = event.startDate ? dayjs(event.startDate) : null;
  const end = event.endDate ? dayjs(event.endDate) : null;

  const coverSrc = event.coverImage && !coverFailed ? imgSrc(event.coverImage) : null;
  const logoSrc =
    event.organization?.logo && !logoFailed
      ? imgSrc(event.organization.logo)
      : null;
  const timeLabel = start
    ? end
      ? `${start.format("HH:mm")} - ${end.format("HH:mm")}`
      : start.format("HH:mm")
    : null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-2 text-left transition hover:border-primary/50 hover:shadow-md"
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-pink-500/20">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={event.title}
              className="h-full w-full object-cover"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-2xl">
              {category?.emoji ?? "✨"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{event.title}</div>
          {timeLabel && (
            <div className="text-xs text-muted-foreground">{timeLabel}</div>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl text-left transition hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]",
        "aspect-square",
      )}
    >
      {/* Background — cover image */}
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverSrc}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 rounded-2xl border border-border/60 bg-card" />
      )}

      {/* Org logo — top-left when no cover */}
      {!coverSrc && logoSrc && (
        <div className="absolute left-3 top-3">
          <div className="h-10 w-10 overflow-hidden rounded-lg shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt={event.organization?.name ?? ""}
              className="h-full w-full object-contain"
              onError={() => setLogoFailed(true)}
            />
          </div>
        </div>
      )}

      {/* Category emoji — when no cover and no logo */}
      {!coverSrc && !logoSrc && (
        <div className="absolute left-3 top-3 text-3xl">
          {category?.emoji ?? "✨"}
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 px-3 pb-3 pt-8",
          coverSrc
            ? "bg-gradient-to-t from-black/80 via-black/40 to-transparent"
            : "bg-gradient-to-t from-background/90 via-background/40 to-transparent",
        )}
      >
        <div
          className={cn(
            "line-clamp-2 text-sm font-bold leading-tight",
            coverSrc ? "text-white" : "text-foreground",
          )}
        >
          {event.title}
        </div>
        {timeLabel && (
          <div
            className={cn(
              "mt-0.5 text-xs font-medium",
              coverSrc ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {timeLabel}
          </div>
        )}
      </div>
    </button>
  );
}
