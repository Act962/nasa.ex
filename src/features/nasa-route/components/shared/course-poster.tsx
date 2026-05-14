"use client";

import Link from "next/link";
import { CalendarDays, Clock, GraduationCap, Play, Users } from "lucide-react";
import { PriceStarsDisplay } from "./price-stars-display";
import { COURSE_FORMAT_LABELS } from "../../types";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { formatEventDate } from "../../lib/event-date";

export interface PosterCourse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  level?: string;
  durationMin?: number | null;
  format?: string;
  priceStars: number;
  studentsCount?: number;
  // Datas do evento — exibidas como badge compacta na capa quando format = "event".
  eventStartsAt?: Date | string | null;
  eventEndsAt?: Date | string | null;
  creatorOrg?: { name: string; logo?: string | null } | null;
}

interface Props {
  href: string;
  course: PosterCourse;
  size?: "sm" | "md" | "lg";
  progressPct?: number | null;
  completed?: boolean;
}

export function CoursePoster({ href, course, size = "md", progressPct, completed }: Props) {
  const widthClass =
    size === "sm" ? "w-44" : size === "lg" ? "w-80" : "w-64";

  const eventDate =
    course.format === "event"
      ? formatEventDate({
          startsAt: course.eventStartsAt,
          endsAt: course.eventEndsAt,
        })
      : null;

  return (
    <Link
      href={href}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl border border-border/40 bg-card transition-all duration-300 hover:scale-[1.06] hover:border-violet-500/60 hover:shadow-2xl hover:shadow-violet-500/20 hover:z-20",
        widthClass,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-violet-500/20 via-indigo-500/15 to-fuchsia-500/10">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc(course.coverUrl)}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-violet-500/40">
            <GraduationCap className="size-10" />
          </div>
        )}

        {eventDate && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-1 text-white backdrop-blur-sm">
            <CalendarDays className="size-3" />
            <div className="leading-tight">
              <div className="text-[10px] font-semibold">{eventDate.dateLine}</div>
              {eventDate.timeLine && (
                <div className="text-[9px] text-white/85">{eventDate.timeLine}</div>
              )}
            </div>
          </div>
        )}

        <div className="absolute right-2 top-2">
          <PriceStarsDisplay priceStars={course.priceStars} size="sm" />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 p-3 text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">
            {course.format && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                {COURSE_FORMAT_LABELS[course.format] ?? course.format}
              </span>
            )}
            {course.durationMin && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {course.durationMin}min
              </span>
            )}
          </div>
          {course.subtitle && (
            <p className="mt-1 line-clamp-2 text-[11px] text-white/85">
              {course.subtitle}
            </p>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/95 text-violet-700 shadow-xl">
            <Play className="size-5 fill-current" />
          </div>
        </div>

        {typeof progressPct === "number" && progressPct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div
              className={cn(
                "h-full transition-all",
                completed ? "bg-amber-500" : "bg-violet-500",
              )}
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1 px-3 pb-3 pt-2">
        <h3 className="line-clamp-1 text-sm font-semibold leading-tight">
          {course.title}
        </h3>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {course.creatorOrg?.name ? (
            <span className="truncate">{course.creatorOrg.name}</span>
          ) : (
            <span />
          )}
          {course.studentsCount && course.studentsCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Users className="size-3" />
              {course.studentsCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
