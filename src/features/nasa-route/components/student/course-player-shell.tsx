"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Check,
  ChevronLeft,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Lock,
  Play,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { VideoEmbed } from "../shared/video-embed";
import { r2NasaRouteVideoUrl } from "../../lib/video-storage-url";
import { LessonListSidebar } from "./lesson-list-sidebar";
import { CourseCompletionCelebration } from "./course-completion-celebration";
import { COURSE_LEVEL_LABELS } from "../../types";

interface Props {
  courseId: string;
  initialLessonId?: string;
}

export function CoursePlayerShell({ courseId, initialLessonId }: Props) {
  const qc = useQueryClient();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(initialLessonId ?? null);
  const [celebration, setCelebration] = useState<{
    courseTitle: string;
    spAwarded: number;
    bonusSp: number;
    certificateCode: string | null;
  } | null>(null);

  const { data, isLoading, isError } = useQuery({
    ...orpc.nasaRoute.getCourseAsStudent.queryOptions({ input: { courseId } }),
  });

  const markComplete = useMutation({
    ...orpc.nasaRoute.markLessonComplete.mutationOptions(),
    onSuccess: (res) => {
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.getCourseAsStudent.queryKey({ input: { courseId } }),
      });
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.listMyEnrollments.queryKey(),
      });

      if (res.lessonSpAwarded > 0) {
        toast.success(`+${res.lessonSpAwarded} Space Points!`, {
          description: "Aula concluída com sucesso.",
        });
      }

      if (res.isFullyComplete && res.courseRewards && data) {
        setCelebration({
          courseTitle: data.course.title,
          spAwarded: res.lessonSpAwarded,
          bonusSp: res.courseRewards.spAwarded,
          certificateCode: res.certificate?.code ?? null,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível marcar a aula.");
    },
  });

  const completedSet = useMemo(
    () => new Set(data?.progress?.completedLessonIds ?? []),
    [data?.progress?.completedLessonIds],
  );

  // Auto-seleciona a primeira aula não concluída do plano quando o curso carrega
  useEffect(() => {
    if (!data || activeLessonId) return;
    const planLessons = data.course.lessons.filter((l) => l.includedInPlan);
    const last = data.progress?.lastLessonId;
    if (last && planLessons.some((l) => l.id === last)) {
      setActiveLessonId(last);
      return;
    }
    const firstNotDone = planLessons.find((l) => !completedSet.has(l.id));
    setActiveLessonId(firstNotDone?.id ?? planLessons[0]?.id ?? data.course.lessons[0]?.id ?? null);
  }, [data, activeLessonId, completedSet]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Curso indisponível</h1>
        <p className="mt-2 text-muted-foreground">
          Você precisa estar matriculado para acessar este curso.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/nasa-route">Voltar</Link>
        </Button>
      </div>
    );
  }

  const { course, progress, enrollment, plan } = data;
  const lessonsInPlan = course.lessons.filter((l) => l.includedInPlan);
  const total = lessonsInPlan.length;
  const done = lessonsInPlan.filter((l) => completedSet.has(l.id)).length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const isFullyComplete = !!progress.completedAt;
  const activeLesson =
    course.lessons.find((l) => l.id === activeLessonId) ?? course.lessons[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/nasa-route"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para meus cursos
      </Link>

      <header className="rounded-3xl border border-border bg-gradient-to-br from-violet-600/10 via-violet-500/5 to-transparent p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">
            {COURSE_LEVEL_LABELS[course.level] ?? course.level}
          </Badge>
          {course.durationMin && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              {course.durationMin} min
            </span>
          )}
          {isFullyComplete && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
              <Trophy className="mr-1 size-3" />
              Concluído
            </Badge>
          )}
          {enrollment.source === "free_access" && (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
              Acesso livre
            </Badge>
          )}
          {plan && (
            <Badge variant="outline" className="border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300">
              Plano: {plan.name}
            </Badge>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{course.title}</h1>
        {course.subtitle && (
          <p className="mt-1 text-lg text-muted-foreground">{course.subtitle}</p>
        )}

        {course.rewardSpOnComplete > 0 && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="size-4" />+{course.rewardSpOnComplete} SP de bônus ao concluir
          </div>
        )}

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {done} / {total} aulas concluídas
            </span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background">
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

      {plan && plan.attachments.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="size-5 text-violet-600" />
            <h2 className="text-base font-semibold">Materiais do plano</h2>
            <span className="text-xs text-muted-foreground">
              · {plan.attachments.length}{" "}
              {plan.attachments.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plan.attachments.map((att) => (
              <li key={att.id}>
                <PlanAttachmentItem attachment={att} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <LessonListSidebar
          modules={course.modules}
          lessons={course.lessons}
          activeLessonId={activeLesson?.id ?? null}
          completedSet={completedSet}
          onSelect={setActiveLessonId}
        />

        <section className="rounded-2xl border border-border bg-card p-6">
          {activeLesson ? (
            <LessonPlayer
              lesson={activeLesson}
              isCompleted={completedSet.has(activeLesson.id)}
              isLoading={markComplete.isPending}
              planName={plan?.name ?? null}
              onComplete={() =>
                markComplete.mutate({ courseId, lessonId: activeLesson.id })
              }
            />
          ) : (
            <div className="text-muted-foreground">Sem aulas disponíveis.</div>
          )}
        </section>
      </div>

      {celebration && (
        <CourseCompletionCelebration
          {...celebration}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

interface LessonAttachmentLite {
  id: string;
  kind: "file" | "image" | "link" | string;
  title: string;
  url?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  description?: string | null;
}

interface LessonPlayerProps {
  lesson: {
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
  };
  isCompleted: boolean;
  isLoading: boolean;
  planName: string | null;
  onComplete: () => void;
}

function LessonPlayer({
  lesson,
  isCompleted,
  isLoading,
  planName,
  onComplete,
}: LessonPlayerProps) {
  const isLocked = !lesson.includedInPlan;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{lesson.title}</h2>
            {isLocked && (
              <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
                <Lock className="size-3" />
                Bloqueado
              </Badge>
            )}
          </div>
          {lesson.summary && (
            <p className="mt-1 text-muted-foreground">{lesson.summary}</p>
          )}
        </div>
        {lesson.durationMin && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {lesson.durationMin}min
          </span>
        )}
      </div>

      <div className="mt-5">
        {isLocked ? (
          <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/40 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-200">
            <div className="max-w-sm text-center">
              <Lock className="mx-auto mb-3 size-10" />
              <p className="text-sm font-semibold">Aula não incluída no seu plano</p>
              <p className="mt-1 text-xs opacity-80">
                {planName
                  ? `O plano "${planName}" não dá acesso a esta aula. Faça upgrade para um plano superior para desbloqueá-la.`
                  : "Faça upgrade do seu plano para desbloquear esta aula."}
              </p>
            </div>
          </div>
        ) : lesson.videoFileKey ? (
          // Vídeo hospedado no R2 NASA Route — <video> nativo, sem iframe.
          <video
            key={lesson.videoFileKey}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-black"
            src={r2NasaRouteVideoUrl(lesson.videoFileKey)}
          />
        ) : lesson.video.embedUrl ? (
          <VideoEmbed url={lesson.video.embedUrl} title={lesson.title} />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-700/30 text-muted-foreground">
            <div className="text-center">
              <Play className="mx-auto mb-2 size-10 opacity-50" />
              <p className="text-sm">Vídeo desta aula em breve</p>
            </div>
          </div>
        )}
      </div>

      {!isLocked && lesson.contentMd && (
        <div className="prose prose-sm dark:prose-invert mt-6 max-w-none whitespace-pre-wrap text-foreground/90">
          {lesson.contentMd}
        </div>
      )}

      {/* Anexos da aula — PDF/imagem/link com view + download.
          Só vem do server quando o aluno tem plano que inclui esta aula. */}
      {!isLocked && lesson.attachments && lesson.attachments.length > 0 && (
        <LessonAttachmentsList attachments={lesson.attachments} />
      )}

      {!isLocked && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            onClick={onComplete}
            disabled={isCompleted || isLoading}
            className={cn(isCompleted && "bg-emerald-500 hover:bg-emerald-500")}
          >
            {isCompleted ? (
              <>
                <Check className="mr-1 size-4" />
                Aula concluída
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>Marcar como concluída</>
            )}
          </Button>
          {!isCompleted && lesson.awardSp > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3 text-violet-500" />
              +{lesson.awardSp} SP ao concluir
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface PlanAttachment {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  fileKey: string | null;
  fileSize: number | null;
}

function PlanAttachmentItem({ attachment }: { attachment: PlanAttachment }) {
  const isPdf = attachment.kind === "pdf";
  const href = isPdf
    ? attachment.fileKey
      ? imgSrc(attachment.fileKey)
      : null
    : attachment.url;

  if (!href) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        {attachment.title} · indisponível
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={isPdf ? true : undefined}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-violet-300 hover:bg-violet-50/40 dark:hover:bg-violet-900/10"
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          isPdf
            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
            : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
        )}
      >
        {isPdf ? <FileText className="size-5" /> : <Link2 className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300">
          {attachment.title}
        </p>
        {attachment.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {attachment.description}
          </p>
        )}
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {isPdf ? (
            <>
              <Download className="size-3" />
              PDF
              {attachment.fileSize ? ` · ${formatFileSize(attachment.fileSize)}` : ""}
            </>
          ) : (
            <>
              <ExternalLink className="size-3" />
              Link externo
            </>
          )}
        </p>
      </div>
    </a>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Lista de anexos da aula (file / image / link) com visualizar +
 * baixar. Aparece abaixo do `contentMd` no player do aluno quando a
 * aula está incluída no plano comprado.
 */
function LessonAttachmentsList({
  attachments,
}: {
  attachments: LessonAttachmentLite[];
}) {
  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Materiais complementares
      </h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {attachments.map((att) => (
          <LessonAttachmentItem key={att.id} attachment={att} />
        ))}
      </div>
    </div>
  );
}

function LessonAttachmentItem({
  attachment,
}: {
  attachment: LessonAttachmentLite;
}) {
  // URL pra abrir/baixar: link externo OU arquivo do S3 (via imgSrc).
  const href =
    attachment.kind === "link"
      ? attachment.url
      : attachment.fileKey
        ? imgSrc(attachment.fileKey)
        : attachment.url ?? null;

  if (!href) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        {attachment.title} · indisponível
      </div>
    );
  }

  const isImage = attachment.kind === "image";
  const isLink = attachment.kind === "link";
  // PDFs e outros arquivos do S3 — força download via attribute.
  const shouldDownload = !isLink;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={shouldDownload ? attachment.fileName ?? true : undefined}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-violet-300 hover:bg-violet-50/40 dark:hover:bg-violet-900/10"
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          isLink
            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
            : isImage
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
        )}
      >
        {isLink ? (
          <Link2 className="size-5" />
        ) : isImage ? (
          // ImageIcon não importado neste arquivo; usa FileText como fallback genérico.
          <FileText className="size-5" />
        ) : (
          <FileText className="size-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300">
          {attachment.title}
        </p>
        {attachment.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {attachment.description}
          </p>
        )}
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {isLink ? (
            <>
              <ExternalLink className="size-3" />
              Link externo
            </>
          ) : (
            <>
              <Download className="size-3" />
              {isImage ? "Imagem" : "Arquivo"}
              {attachment.fileSize
                ? ` · ${formatFileSize(attachment.fileSize)}`
                : ""}
            </>
          )}
        </p>
      </div>
    </a>
  );
}
