"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useState } from "react";
import {
  Award,
  Check,
  ChevronLeft,
  Clock,
  Lock,
  Play,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { youtubeEmbedUrl } from "../lib/youtube";
import { TrackCompletionCelebration } from "./track-completion-celebration";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export function TrackDetail({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<any>(null);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.getTrack.queryOptions({ input: { slug } }),
  });

  const mut = useMutation({
    ...orpc.spaceHelp.markLessonComplete.mutationOptions(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.getTrack.queryKey({ input: { slug } }) });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listTracks.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listUserBadges.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.getSetupProgress.queryKey() });
      if (res.isFullyComplete && res.rewards) {
        setCelebration({
          trackTitle: data?.track.title,
          ...res.rewards,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível marcar a aula.");
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const { track, progress } = data;
  const completedSet = new Set(progress?.completedLessonIds ?? []);
  const total = track.lessons.length;
  const done = completedSet.size;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const isFullyComplete = !!progress?.completedAt;
  const activeLesson = track.lessons.find((l) => l.id === activeLessonId) ?? track.lessons[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/space-help"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="size-4" />
        Voltar para Space Help
      </Link>

      <header className="rounded-3xl border border-border bg-gradient-to-br from-violet-600/10 via-violet-500/5 to-transparent p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{LEVEL_LABELS[track.level] ?? track.level}</Badge>
          {track.durationMin && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              {track.durationMin} min
            </span>
          )}
          {isFullyComplete && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
              <Trophy className="size-3 mr-1" />
              Concluída
            </Badge>
          )}
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{track.title}</h1>
        {track.subtitle && (
          <p className="mt-1 text-lg text-muted-foreground">{track.subtitle}</p>
        )}
        {track.description && (
          <p className="mt-3 text-sm md:text-base text-foreground/80 max-w-3xl">
            {track.description}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {track.rewardSpacePoints > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1.5 text-sm text-violet-700 dark:text-violet-300 font-medium">
              <Sparkles className="size-4" /> {track.rewardSpacePoints} Space Points
            </span>
          )}
          {track.rewardStars > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-300 font-medium">
              <Star className="size-4" /> {track.rewardStars} Stars
            </span>
          )}
          {track.rewardBadge && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
              style={{
                backgroundColor: (track.rewardBadge.color ?? "#7C3AED") + "20",
                color: track.rewardBadge.color ?? "#7C3AED",
              }}
            >
              <Award className="size-4" /> Selo {track.rewardBadge.name}
            </span>
          )}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              {done} / {total} aulas concluídas
            </span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-background overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isFullyComplete ? "bg-amber-500" : "bg-violet-600",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Aulas</h2>
          </div>
          <ul>
            {track.lessons.map((l, i) => {
              const completed = completedSet.has(l.id);
              const active = activeLesson?.id === l.id;
              const locked =
                !completed && l.requiredStepKey && !l.requiredStepCompleted;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setActiveLessonId(l.id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-muted transition border-l-2",
                      active
                        ? "border-violet-600 bg-violet-500/5"
                        : "border-transparent",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        completed
                          ? "bg-amber-500 text-white"
                          : locked
                            ? "bg-muted text-muted-foreground/60"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {completed ? (
                        <Check className="size-3" />
                      ) : locked ? (
                        <Lock className="size-3" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight">{l.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        {l.durationMin && (
                          <>
                            <Clock className="size-3" /> {l.durationMin} min
                          </>
                        )}
                        {locked && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            • passo pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="rounded-2xl border border-border bg-card p-6">
          {activeLesson ? (
            <LessonContent
              lesson={activeLesson}
              isCompleted={completedSet.has(activeLesson.id)}
              onComplete={() =>
                mut.mutate({ trackId: track.id, lessonId: activeLesson.id })
              }
              loading={mut.isPending}
            />
          ) : (
            <div className="text-muted-foreground">Sem aulas disponíveis.</div>
          )}
        </section>
      </div>

      {celebration && (
        <TrackCompletionCelebration
          {...celebration}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

function LessonContent({
  lesson,
  isCompleted,
  onComplete,
  loading,
}: {
  lesson: any;
  isCompleted: boolean;
  onComplete: () => void;
  loading: boolean;
}) {
  const embed = youtubeEmbedUrl(lesson.youtubeUrl);
  const locked =
    !isCompleted && !!lesson.requiredStepKey && !lesson.requiredStepCompleted;
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{lesson.title}</h2>
      {lesson.summary && <p className="mt-1 text-muted-foreground">{lesson.summary}</p>}
      {embed && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          <div className="aspect-video bg-black">
            <iframe
              src={embed}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={lesson.title}
            />
          </div>
        </div>
      )}
      {!embed && (
        <div className="mt-5 flex aspect-video items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-700/30 text-muted-foreground">
          <div className="text-center">
            <Play className="size-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Vídeo desta aula em breve</p>
          </div>
        </div>
      )}

      {lesson.contentMd && (
        <div className="mt-6 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground/90">
          {lesson.contentMd}
        </div>
      )}

      {locked && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Conclua o passo no Setup Inicial para liberar esta aula
            </p>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
              Esta aula só pode ser marcada como concluída depois que você
              executar o passo correspondente:{" "}
              <strong>{lesson.requiredStepLabel ?? "passo do setup"}</strong>.
            </p>
            {lesson.requiredStepCtaHref && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-3 h-7 text-xs"
              >
                <Link href={lesson.requiredStepCtaHref}>Ir para o passo</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <Button
          onClick={onComplete}
          disabled={isCompleted || loading || locked}
          className={cn(isCompleted && "bg-amber-500 hover:bg-amber-500")}
          title={
            locked
              ? `Faça antes: ${lesson.requiredStepLabel ?? "passo do setup"}`
              : undefined
          }
        >
          {isCompleted ? (
            <>
              <Check className="size-4 mr-1" />
              Aula concluída
            </>
          ) : locked ? (
            <>
              <Lock className="size-4 mr-1" />
              Bloqueada — faça o passo primeiro
            </>
          ) : loading ? (
            "Salvando…"
          ) : (
            "Marcar como concluída"
          )}
        </Button>
      </div>
    </div>
  );
}
