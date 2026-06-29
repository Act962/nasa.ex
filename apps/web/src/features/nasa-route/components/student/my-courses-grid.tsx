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

export function MyCoursesGrid() {
  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.listMyEnrollments.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    );
  }

  const enrollments = data?.enrollments ?? [];

  if (enrollments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-16 text-center">
        <Search className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Você ainda não está matriculado em cursos</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Explore o catálogo e comece sua jornada com STARs.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {enrollments.map((e) => {
        const lessonId = e.progress.lastLessonId;
        const href = lessonId
          ? `/nasa-route/curso/${e.course.id}/aula/${lessonId}`
          : `/nasa-route/curso/${e.course.id}`;
        const isComplete = !!e.completedAt;
        return (
          <Link
            key={e.id}
            href={href}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-violet-500/20 via-indigo-500/15 to-fuchsia-500/10">
              {e.course.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc(e.course.coverUrl)}
                  alt={e.course.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-violet-500/40">
                  <GraduationCap className="size-12" />
                </div>
              )}
              {isComplete && (
                <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-medium text-white">
                  <Trophy className="size-3" />
                  Concluído
                </div>
              )}
              {!isComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  <div className="rounded-full bg-white/90 p-3 text-violet-700">
                    <Play className="size-5 fill-current" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                  {COURSE_FORMAT_LABELS[e.course.format] ?? e.course.format}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {COURSE_LEVEL_LABELS[e.course.level] ?? e.course.level}
                </span>
                {e.source === "free_access" && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    Acesso livre
                  </span>
                )}
              </div>

              <h3 className="line-clamp-2 font-semibold leading-tight">{e.course.title}</h3>
              {e.course.subtitle && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {e.course.subtitle}
                </p>
              )}

              <div className="mt-1">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {e.progress.completed} / {e.progress.total} aulas
                  </span>
                  <span className="font-medium">{e.progress.pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isComplete ? "bg-amber-500" : "bg-violet-600",
                    )}
                    style={{ width: `${e.progress.pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[11px] text-muted-foreground">
                {e.course.durationMin && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {e.course.durationMin} min
                  </span>
                )}
              </div>

              {e.course.creatorOrg && (
                <div className="flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  {e.course.creatorOrg.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.course.creatorOrg.logo}
                      alt={e.course.creatorOrg.name}
                      className="size-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-5 rounded-full bg-muted" />
                  )}
                  <span className="truncate">{e.course.creatorOrg.name}</span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
