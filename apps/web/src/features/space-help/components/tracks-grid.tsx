"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Award, Clock, Sparkles, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export function TracksGrid() {
  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.listTracks.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data?.tracks.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center text-muted-foreground">
        Nenhuma rota de conhecimento publicada ainda.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {data.tracks.map((t) => {
        const completed = t.completedAt !== null;
        const progressPct =
          t.lessonCount > 0 ? Math.min(100, (t.completedLessonCount / t.lessonCount) * 100) : 0;
        return (
          <Link
            key={t.id}
            href={`/space-help/trilhas/${t.slug}`}
            className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-violet-500/50 hover:shadow-lg overflow-hidden"
          >
            <div
              className={cn(
                "absolute -right-12 -top-12 size-44 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60",
                completed ? "bg-amber-400" : "bg-violet-500",
              )}
            />
            <div className="relative flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="text-xs">
                {LEVEL_LABELS[t.level] ?? t.level}
              </Badge>
              {t.durationMin && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {t.durationMin} min
                </span>
              )}
              {completed && (
                <Badge className="bg-amber-500 text-white text-xs hover:bg-amber-500">
                  Concluída
                </Badge>
              )}
            </div>

            <h3 className="relative text-xl font-bold tracking-tight leading-tight">
              {t.title}
            </h3>
            {t.subtitle && (
              <p className="relative mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
            )}

            <div className="relative mt-4 flex flex-wrap items-center gap-3 text-xs">
              {t.rewardSpacePoints > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-1 text-violet-700 dark:text-violet-300 font-medium">
                  <Sparkles className="size-3" /> {t.rewardSpacePoints} SP
                </span>
              )}
              {t.rewardStars > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300 font-medium">
                  <Star className="size-3" /> {t.rewardStars} Stars
                </span>
              )}
              {t.rewardBadge && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium"
                  style={{
                    backgroundColor: (t.rewardBadge.color ?? "#7C3AED") + "20",
                    color: t.rewardBadge.color ?? "#7C3AED",
                  }}
                >
                  <Award className="size-3" /> {t.rewardBadge.name}
                </span>
              )}
            </div>

            <div className="relative mt-auto pt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>
                  {t.completedLessonCount} / {t.lessonCount} aulas
                </span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    completed ? "bg-amber-500" : "bg-violet-600",
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {completed && (
              <Trophy className="absolute right-4 top-4 size-5 text-amber-500" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
