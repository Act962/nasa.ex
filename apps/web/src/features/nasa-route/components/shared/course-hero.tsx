"use client";

import Link from "next/link";
import { CalendarDays, Clock, GraduationCap, Info, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceStarsDisplay } from "./price-stars-display";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { formatEventDate } from "../../lib/event-date";

interface HeroCourse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  level?: string;
  format?: string;
  durationMin?: number | null;
  /** Stars permanece no tipo por compat — não é mais usado pra exibição. */
  priceStars?: number;
  priceBrlCents?: number | null;
  /** Preço derivado do plano padrão; quando presente, prevalece sobre `priceBrlCents`. */
  displayPriceBrlCents?: number | null;
  isFree?: boolean;
  studentsCount?: number;
  // Datas do evento (format = "event") — exibidas como badge proeminente no hero.
  eventStartsAt?: Date | string | null;
  eventEndsAt?: Date | string | null;
  creatorOrg?: { slug?: string; name?: string; logo?: string | null } | null;
}

interface Props {
  course: HeroCourse;
  href: string;
  publicHref?: string;
}

export function CourseHero({ course, href, publicHref }: Props) {
  const eventDate =
    course.format === "event"
      ? formatEventDate({
          startsAt: course.eventStartsAt,
          endsAt: course.eventEndsAt,
        })
      : null;

  return (
    <div className="relative h-[58vh] min-h-[420px] w-full overflow-hidden">
      <div className="absolute inset-0">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc(course.coverUrl)}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative flex h-full items-end pb-16 pl-4 md:items-center md:pb-0 md:pl-12 lg:pl-16">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
            <span className="rounded-sm bg-violet-600/95 px-2 py-1 text-white">
              NASA Route
            </span>
            {course.format && (
              <span className="rounded-sm bg-white/10 px-2 py-1 text-white backdrop-blur-sm">
                {COURSE_FORMAT_LABELS[course.format] ?? course.format}
              </span>
            )}
            {course.level && (
              <span className="rounded-sm bg-white/10 px-2 py-1 text-white backdrop-blur-sm">
                {COURSE_LEVEL_LABELS[course.level] ?? course.level}
              </span>
            )}
            {eventDate && (
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-violet-600/95 px-2 py-1 text-white">
                <CalendarDays className="size-3.5" />
                <span>{eventDate.dateLine}</span>
                {eventDate.timeLine && (
                  <span className="text-white/85">· {eventDate.timeLine}</span>
                )}
              </span>
            )}
          </div>

          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground drop-shadow-lg md:text-5xl lg:text-6xl">
            {course.title}
          </h1>

          {course.subtitle && (
            <p className="mt-4 line-clamp-3 max-w-xl text-base text-foreground/85 drop-shadow md:text-lg">
              {course.subtitle}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-foreground/80">
            <PriceStarsDisplay
              priceBrlCents={course.displayPriceBrlCents ?? course.priceBrlCents}
              isFree={course.isFree}
              size="md"
            />
            {course.durationMin && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" />
                {course.durationMin} min
              </span>
            )}
            {course.studentsCount && course.studentsCount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                {course.studentsCount} alunos
              </span>
            ) : null}
            {course.creatorOrg?.name && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-4" />
                {course.creatorOrg.name}
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href={href}>
                <Play className="size-5 fill-current" />
                Ver curso
              </Link>
            </Button>
            {publicHref && (
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="gap-2 bg-white/15 text-foreground backdrop-blur-sm hover:bg-white/25"
              >
                <Link href={publicHref}>
                  <Info className="size-5" />
                  Mais informações
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
