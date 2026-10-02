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
    <div className="px-4 md:px-0">
    <div className="relative h-[340px] w-full overflow-hidden rounded-[24px] md:h-[58vh] md:min-h-[420px] md:rounded-none">
      <div className="absolute inset-0">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc(course.coverUrl)}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-info" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent md:bg-gradient-to-r md:via-background/80" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative flex h-full items-end px-4 pb-5 md:items-center md:px-0 md:pb-0 md:pl-12 lg:pl-16">
        <div className="max-w-2xl min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold tracking-wider text-info uppercase md:mb-3 md:gap-2 md:text-[11px]">
            <span className="rounded-full bg-info/95 px-2 py-1 text-white">
              ÓRBITA Route
            </span>
            {course.format && (
              <span className="rounded-full bg-foreground/10 px-2 py-1 text-foreground backdrop-blur-sm">
                {COURSE_FORMAT_LABELS[course.format] ?? course.format}
              </span>
            )}
            {course.level && (
              <span className="rounded-full bg-foreground/10 px-2 py-1 text-foreground backdrop-blur-sm">
                {COURSE_LEVEL_LABELS[course.level] ?? course.level}
              </span>
            )}
            {eventDate && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info/95 px-2 py-1 text-white">
                <CalendarDays className="size-3.5" />
                <span>{eventDate.dateLine}</span>
                {eventDate.timeLine && (
                  <span className="text-white/85">· {eventDate.timeLine}</span>
                )}
              </span>
            )}
          </div>

          <h2 className="line-clamp-2 text-2xl leading-[1.1] font-extrabold tracking-tight text-foreground drop-shadow-lg md:line-clamp-none md:text-5xl md:leading-[1.05] lg:text-6xl">
            {course.title}
          </h2>

          {course.subtitle && (
            <p className="mt-2 line-clamp-2 max-w-xl text-sm text-foreground/85 drop-shadow md:mt-4 md:line-clamp-3 md:text-lg">
              {course.subtitle}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-foreground/80 md:mt-5 md:gap-4 md:text-sm">
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
              <span className="inline-flex items-center gap-1.5 max-md:hidden">
                <Users className="size-4" />
                {course.studentsCount} alunos
              </span>
            ) : null}
            {course.creatorOrg?.name && (
              <span className="inline-flex items-center gap-1.5 max-md:hidden">
                <GraduationCap className="size-4" />
                {course.creatorOrg.name}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 md:mt-6">
            <Button asChild size="lg" className="h-11 gap-2 rounded-full max-md:flex-1">
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
                className="gap-2 bg-foreground/10 text-foreground backdrop-blur-sm hover:bg-foreground/15 max-md:hidden"
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
    </div>
  );
}
