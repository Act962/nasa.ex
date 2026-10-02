"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Clock, GraduationCap, Play, Search, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

interface MyCoursesGridProps {
  onExploreCatalog?: () => void;
}

export function MyCoursesGrid({ onExploreCatalog }: MyCoursesGridProps) {
  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.listMyEnrollments.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3">
        {[1, 2, 3, 4].map((placeholderIndex) => (
          <Skeleton key={placeholderIndex} className="aspect-[3/4] rounded-[20px]" />
        ))}
      </div>
    );
  }

  const enrollments = data?.enrollments ?? [];

  if (enrollments.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-line p-10 text-center md:p-16">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
          <Search className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">Você ainda não está em nenhum curso</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Explore o catálogo e comece sua jornada com STARs.
        </p>
        {onExploreCatalog && (
          <Button onClick={onExploreCatalog} className="mt-4 h-11 rounded-full md:h-9">
            Explorar cursos
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3">
      {enrollments.map((enrollment) => {
        const lessonId = enrollment.progress.lastLessonId;
        const href = lessonId
          ? `/nasa-route/curso/${enrollment.course.id}/aula/${lessonId}`
          : `/nasa-route/curso/${enrollment.course.id}`;
        const isComplete = !!enrollment.completedAt;
        return (
          <Link
            key={enrollment.id}
            href={href}
            className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-line bg-card transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-info/15">
              {enrollment.course.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc(enrollment.course.coverUrl)}
                  alt={enrollment.course.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-info/40">
                  <GraduationCap className="size-12" />
                </div>
              )}
              {isComplete && (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-medium text-white md:px-2.5 md:py-1 md:text-[11px]">
                  <Trophy className="size-3" />
                  Concluído
                </div>
              )}
              {!isComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100 max-md:hidden">
                  <div className="rounded-full bg-white/90 p-3 text-info">
                    <Play className="size-5 fill-current" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 md:gap-2 md:p-4">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground md:text-[11px]">
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                  {COURSE_FORMAT_LABELS[enrollment.course.format] ?? enrollment.course.format}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 max-md:hidden">
                  {COURSE_LEVEL_LABELS[enrollment.course.level] ?? enrollment.course.level}
                </span>
                {enrollment.source === "free_access" && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
                    Acesso livre
                  </span>
                )}
              </div>

              <h3 className="line-clamp-2 text-sm leading-tight font-semibold md:text-base">{enrollment.course.title}</h3>
              {enrollment.course.subtitle && (
                <p className="line-clamp-2 text-sm text-muted-foreground max-md:hidden">
                  {enrollment.course.subtitle}
                </p>
              )}

              <div className="mt-1">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {enrollment.progress.completed} / {enrollment.progress.total} aulas
                  </span>
                  <span className="font-medium">{enrollment.progress.pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isComplete ? "bg-warning" : "bg-info",
                    )}
                    style={{ width: `${enrollment.progress.pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[11px] text-muted-foreground max-md:hidden">
                {enrollment.course.durationMin && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {enrollment.course.durationMin} min
                  </span>
                )}
              </div>

              {enrollment.course.creatorOrg && (
                <div className="flex items-center gap-2 border-t border-line pt-2 text-xs text-muted-foreground max-md:hidden">
                  {enrollment.course.creatorOrg.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={enrollment.course.creatorOrg.logo}
                      alt={enrollment.course.creatorOrg.name}
                      className="size-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-5 rounded-full bg-muted" />
                  )}
                  <span className="truncate">{enrollment.course.creatorOrg.name}</span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
