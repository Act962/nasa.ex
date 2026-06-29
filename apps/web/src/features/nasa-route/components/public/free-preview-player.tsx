"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoEmbed } from "../shared/video-embed";
import { r2NasaRouteVideoUrl } from "@/features/nasa-route/lib/video-storage-url";

interface Props {
  companySlug: string;
  courseSlug: string;
  lessonId: string;
}

export function FreePreviewPlayer({ companySlug, courseSlug, lessonId }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    ...orpc.nasaRoute.publicGetFreeLesson.queryOptions({
      input: { companySlug, courseSlug, lessonId },
    }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 aspect-video w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Aula indisponível</h1>
        <p className="mt-2 text-muted-foreground">
          {(error as Error)?.message ?? "Esta aula só está disponível para alunos matriculados."}
        </p>
        <Link
          href={`/c/${companySlug}/${courseSlug}`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
        >
          <ChevronLeft className="size-4" />
          Voltar ao curso
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/c/${companySlug}/${courseSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {data.courseTitle}
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{data.lesson.title}</h1>
      {data.lesson.summary && (
        <p className="mt-1 text-sm text-muted-foreground">{data.lesson.summary}</p>
      )}

      <div className="mt-5">
        {/* Player condicional: vídeo upado no R2 → `<video>` nativo;
            URL YouTube/Vimeo → iframe via VideoEmbed; sem nada →
            mensagem "Vídeo indisponível" (do VideoEmbed). Antes,
            qualquer aula com videoFileKey caia em "indisponível" porque
            embedUrl é null pra vídeos R2 — esse era o bug. */}
        {data.lesson.videoFileKey ? (
          <video
            key={data.lesson.videoFileKey}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-2xl border border-border bg-black"
            src={r2NasaRouteVideoUrl(data.lesson.videoFileKey)}
          />
        ) : (
          <VideoEmbed url={data.lesson.video.embedUrl} title={data.lesson.title} />
        )}
      </div>

      {data.lesson.contentMd && (
        <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {data.lesson.contentMd}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-900 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-200">
        <p className="font-semibold">Gostou da aula?</p>
        <p className="mt-1">
          Compre o curso completo com STARs e ganhe Space Points por cada aula concluída.
        </p>
        <Link
          href={`/c/${companySlug}/${courseSlug}`}
          className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          Ver detalhes do curso
        </Link>
      </div>
    </div>
  );
}
