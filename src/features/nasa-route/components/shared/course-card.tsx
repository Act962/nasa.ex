import Link from "next/link";
import { CalendarDays, Clock, GraduationCap, Users } from "lucide-react";
import { PriceStarsDisplay } from "./price-stars-display";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { formatEventDate } from "../../lib/event-date";

interface CourseCardProps {
  href: string;
  course: {
    id: string;
    slug: string;
    title: string;
    subtitle?: string | null;
    coverUrl?: string | null;
    level: string;
    durationMin?: number | null;
    format: string;
    priceStars: number;
    studentsCount: number;
    lessonCount?: number;
    // Datas do evento — exibidas como badge na capa quando format = "event".
    eventStartsAt?: Date | string | null;
    eventEndsAt?: Date | string | null;
    creatorOrg?: { name: string; logo?: string | null } | null;
  };
}

export function CourseCard({ href, course }: CourseCardProps) {
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-violet-500/20 via-indigo-500/15 to-fuchsia-500/10">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc(course.coverUrl)}
            alt={course.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-violet-500/40">
            <GraduationCap className="size-12" />
          </div>
        )}
        {eventDate && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1 text-white backdrop-blur-sm">
            <CalendarDays className="size-3.5" />
            <div className="leading-tight">
              <div className="text-xs font-semibold">{eventDate.dateLine}</div>
              {eventDate.timeLine && (
                <div className="text-[10px] text-white/85">
                  {eventDate.timeLine}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="absolute right-2 top-2">
          <PriceStarsDisplay priceStars={course.priceStars} size="sm" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
            {COURSE_FORMAT_LABELS[course.format] ?? course.format}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5">
            {COURSE_LEVEL_LABELS[course.level] ?? course.level}
          </span>
        </div>

        <h3 className={cn("font-semibold leading-tight", course.subtitle ? "line-clamp-2" : "line-clamp-3")}>
          {course.title}
        </h3>
        {course.subtitle && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{course.subtitle}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[11px] text-muted-foreground">
          {course.lessonCount !== undefined && (
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="size-3" />
              {course.lessonCount} {course.lessonCount === 1 ? "aula" : "aulas"}
            </span>
          )}
          {course.durationMin && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {course.durationMin} min
            </span>
          )}
          {course.studentsCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {course.studentsCount}
            </span>
          )}
        </div>

        {course.creatorOrg && (
          <div className="flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            {course.creatorOrg.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.creatorOrg.logo}
                alt={course.creatorOrg.name}
                className="size-5 rounded-full object-cover"
              />
            ) : (
              <div className="size-5 rounded-full bg-muted" />
            )}
            <span className="truncate">{course.creatorOrg.name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
