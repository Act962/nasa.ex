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
  /** Stars permanece no tipo por compat — não é mais usado pra exibição. */
  priceStars?: number;
  priceBrlCents?: number | null;
  /** Preço derivado do plano padrão; quando presente, prevalece sobre `priceBrlCents`. */
  displayPriceBrlCents?: number | null;
  isFree?: boolean;
  studentsCount?: number;
  // Datas UNIFICADAS — válidas pra qualquer formato (curso/treinamento/
  // mentoria/ebook/evento/etc). Exibidas como badge na capa quando
  // preenchidas. Prevalecem sobre os legados `eventStartsAt`/`eventEndsAt`.
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  // Datas LEGADAS (só `format = "event"`) — fallback pra cursos antigos.
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

  // Data exibida no badge — válida pra QUALQUER formato. Prioridade:
  // novos campos `startsAt`/`endsAt` (todos os formatos) → legados
  // `eventStartsAt`/`eventEndsAt` (só event, retrocompat).
  const dateStartsAt = course.startsAt ?? course.eventStartsAt ?? null;
  const dateEndsAt = course.endsAt ?? course.eventEndsAt ?? null;
  const eventDate = dateStartsAt
    ? formatEventDate({ startsAt: dateStartsAt, endsAt: dateEndsAt })
    : null;

  return (
    <Link
      href={href}
      className={cn(
        "group relative min-w-0 shrink-0 overflow-hidden rounded-[18px] border border-line bg-card transition-all duration-300 md:hover:z-20 md:hover:scale-[1.06] md:hover:border-info/60 md:hover:shadow-2xl md:hover:shadow-info/20",
        widthClass,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-info/15">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc(course.coverUrl)}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-info/40">
            <GraduationCap className="size-10" />
          </div>
        )}

        {eventDate && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 text-white backdrop-blur-sm">
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
          <PriceStarsDisplay
            priceBrlCents={course.displayPriceBrlCents ?? course.priceBrlCents}
            isFree={course.isFree}
            size="sm"
          />
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

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 max-md:hidden group-hover:opacity-100">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/95 text-info shadow-xl">
            <Play className="size-5 fill-current" />
          </div>
        </div>

        {typeof progressPct === "number" && progressPct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div
              className={cn(
                "h-full transition-all",
                completed ? "bg-warning" : "bg-info",
              )}
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1 px-2.5 pt-2 pb-2.5 md:px-3 md:pb-3">
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
