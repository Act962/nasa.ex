"use client";

import { Check, ChevronRight, Clock, ListVideo, Lock, Play, Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { VideoEmbed } from "../shared/video-embed";
import { r2NasaRouteVideoUrl } from "../../lib/video-storage-url";
import { LessonAttachmentsList, type LessonAttachmentLite } from "./lesson-attachments";

export interface LessonPlayerLesson {
  id: string;
  title: string;
  summary: string | null;
  contentMd: string | null;
  durationMin: number | null;
  awardSp: number;
  includedInPlan: boolean;
  video: { provider: string | null; videoId: string | null; embedUrl: string | null };
  videoFileKey?: string | null;
  videoFileSize?: number | null;
  attachments?: LessonAttachmentLite[];
}

interface LessonPlayerProps {
  lesson: LessonPlayerLesson;
  isCompleted: boolean;
  isLoading: boolean;
  planName: string | null;
  onComplete: () => void;
  /** Celular: abre a gaveta com a lista de aulas. */
  onOpenLessons?: () => void;
  onNextLesson?: () => void;
}

/** Vídeo na largura toda da tela no celular; no computador fica dentro do cartão. */
const FULL_BLEED_MEDIA_CLASS = "-mx-4 w-[calc(100%+2rem)] max-w-none lg:mx-0 lg:w-full";

export function LessonPlayer({
  lesson,
  isCompleted,
  isLoading,
  planName,
  onComplete,
  onOpenLessons,
  onNextLesson,
}: LessonPlayerProps) {
  const isLocked = !lesson.includedInPlan;

  return (
    <div>
      <div className={FULL_BLEED_MEDIA_CLASS}>
        {isLocked ? (
          <div className="flex aspect-video items-center justify-center border-y border-dashed border-warning/30 bg-warning/5 px-4 text-warning lg:rounded-[20px] lg:border">
            <div className="max-w-sm text-center">
              <Lock className="mx-auto mb-3 size-8 md:size-10" />
              <p className="text-sm font-semibold">Aula não incluída no seu plano</p>
              <p className="mt-1 text-xs opacity-80">
                {planName
                  ? `O plano "${planName}" não dá acesso a esta aula. Troque para um plano maior para liberar.`
                  : "Troque para um plano maior para liberar esta aula."}
              </p>
            </div>
          </div>
        ) : lesson.videoFileKey ? (
          <video
            key={lesson.videoFileKey}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black lg:rounded-[20px]"
            src={r2NasaRouteVideoUrl(lesson.videoFileKey)}
          />
        ) : lesson.video.embedUrl ? (
          <VideoEmbed
            url={lesson.video.embedUrl}
            title={lesson.title}
            className="max-lg:rounded-none max-lg:border-x-0"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-info/20 text-muted-foreground lg:rounded-[20px]">
            <div className="text-center">
              <Play className="mx-auto mb-2 size-10 opacity-50" />
              <p className="text-sm">Vídeo desta aula em breve</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3 lg:mt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg leading-tight font-bold tracking-tight md:text-2xl">{lesson.title}</h2>
            {isLocked && (
              <Badge variant="outline" className="gap-1 border-warning/30 text-warning">
                <Lock className="size-3" />
                Bloqueada
              </Badge>
            )}
          </div>
          {lesson.summary && <p className="mt-1 text-sm text-muted-foreground md:text-base">{lesson.summary}</p>}
        </div>
        {lesson.durationMin && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {lesson.durationMin}min
          </span>
        )}
      </div>

      {!isLocked && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <Button
            onClick={onComplete}
            disabled={isCompleted || isLoading}
            className={cn("h-12 w-full rounded-full text-base sm:h-9 sm:w-auto sm:text-sm", isCompleted && "bg-success hover:bg-success")}
          >
            {isCompleted ? (
              <>
                <Check className="mr-1 size-4" />
                Aula concluída
              </>
            ) : isLoading ? (
              <>
                <OrbitaSpinner className="mr-1 size-4" />
                Salvando…
              </>
            ) : (
              <>Marcar como concluída</>
            )}
          </Button>
          {!isCompleted && lesson.awardSp > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground max-sm:justify-center">
              <Sparkles className="size-3 text-info" />+{lesson.awardSp} SP ao concluir
            </span>
          )}
        </div>
      )}

      {(onOpenLessons || onNextLesson) && (
        <div className={cn("mt-3 grid gap-2 lg:hidden", onOpenLessons && onNextLesson ? "grid-cols-2" : "grid-cols-1")}>
          {onOpenLessons && (
            <Button variant="outline" onClick={onOpenLessons} className="h-11 gap-1.5 rounded-full">
              <ListVideo className="size-4" />
              Aulas
            </Button>
          )}
          {onNextLesson && (
            <Button variant="outline" onClick={onNextLesson} className="h-11 gap-1.5 rounded-full">
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      )}

      {!isLocked && lesson.contentMd && (
        <div className="prose prose-sm dark:prose-invert mt-6 max-w-none whitespace-pre-wrap text-foreground/90">
          {lesson.contentMd}
        </div>
      )}

      {!isLocked && lesson.attachments && lesson.attachments.length > 0 && (
        <LessonAttachmentsList attachments={lesson.attachments} />
      )}
    </div>
  );
}
