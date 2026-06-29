"use client";

import Link from "next/link";
import { Lock, Play, ImageIcon } from "lucide-react";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface ModuleData {
  id: string;
  title: string;
  summary: string | null;
  order: number;
}

interface LessonData {
  id: string;
  moduleId: string | null;
  title: string;
  summary: string | null;
  /** Chave S3 da thumbnail — opcional. */
  thumbnailKey?: string | null;
  durationMin: number | null;
  isFreePreview: boolean;
  order: number;
}

interface Props {
  modules: ModuleData[];
  lessons: LessonData[];
  companySlug: string;
  courseSlug: string;
}

/**
 * Lista de módulos/aulas do curso na página pública.
 * Mostra thumbnail à esquerda (placeholder se vazio), badge "GRÁTIS"
 * verde pra previews + CTA "▶ Assistir grátis" bem visível.
 *
 * Extraído de `course-public-page.tsx` pra manter o arquivo principal
 * abaixo de 400 linhas (regra do projeto).
 */
export function CourseLessonsSection({
  modules,
  lessons,
  companySlug,
  courseSlug,
}: Props) {
  const grouped = groupLessonsByModule(modules, lessons);
  const freeCount = lessons.filter((l) => l.isFreePreview).length;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Conteúdo do curso</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {lessons.length} {lessons.length === 1 ? "aula" : "aulas"}
        {freeCount > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {freeCount} {freeCount === 1 ? "gratuita" : "gratuitas"}
            </span>
          </>
        )}
      </p>

      <div className="mt-4 space-y-3">
        {grouped.map((group) => (
          <div
            key={group.id ?? "no-module"}
            className="rounded-2xl border border-border bg-card"
          >
            {group.title && (
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">{group.title}</h3>
                {group.summary && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {group.summary}
                  </p>
                )}
              </div>
            )}
            <ul className="divide-y divide-border">
              {group.lessons.map((l) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  companySlug={companySlug}
                  courseSlug={courseSlug}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Linha de aula isolada — usa `useConstructUrl` (hook) que precisa rodar
 * 1 vez por aula, daí ser um sub-componente em vez de inline no map.
 */
function LessonRow({
  lesson,
  companySlug,
  courseSlug,
}: {
  lesson: LessonData;
  companySlug: string;
  courseSlug: string;
}) {
  const thumbUrl = useConstructUrl(lesson.thumbnailKey || "");
  const isFree = lesson.isFreePreview;

  const inner = (
    <li
      className={`group flex items-center gap-3 px-3 py-3 sm:px-5 transition-colors ${
        isFree ? "cursor-pointer hover:bg-violet-50/40 dark:hover:bg-violet-950/20" : ""
      }`}
    >
      {/* Thumbnail à esquerda — 64×40 (proporção vídeo). Placeholder
          com ícone quando não há `thumbnailKey`. */}
      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {lesson.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={lesson.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-4 text-muted-foreground/40" />
          </div>
        )}
        {/* Overlay do estado (free/locked) sobre a thumbnail */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            isFree ? "bg-violet-600/40" : "bg-black/40"
          }`}
        >
          {isFree ? (
            <Play className="size-4 text-white" fill="white" />
          ) : (
            <Lock className="size-3.5 text-white/80" />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{lesson.title}</p>
          {isFree && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Grátis
            </span>
          )}
        </div>
        {lesson.summary && (
          <p className="truncate text-xs text-muted-foreground">
            {lesson.summary}
          </p>
        )}
      </div>

      {lesson.durationMin && (
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          {lesson.durationMin} min
        </span>
      )}

      {isFree ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-transform group-hover:scale-105">
          <Play className="size-3" fill="currentColor" />
          Assistir grátis
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="size-3" />
          Bloqueado
        </span>
      )}
    </li>
  );

  return isFree ? (
    <Link
      href={`/c/${companySlug}/${courseSlug}/preview/${lesson.id}`}
      className="block"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

function groupLessonsByModule(modules: ModuleData[], lessons: LessonData[]) {
  const byModule = new Map<string | null, LessonData[]>();
  for (const l of lessons) {
    const key = l.moduleId;
    const arr = byModule.get(key) ?? [];
    arr.push(l);
    byModule.set(key, arr);
  }
  for (const arr of byModule.values()) {
    arr.sort((a, b) => a.order - b.order);
  }

  const groups: Array<{
    id: string | null;
    title: string | null;
    summary: string | null;
    lessons: LessonData[];
  }> = [];

  const noModule = byModule.get(null) ?? [];
  if (noModule.length > 0) {
    groups.push({ id: null, title: null, summary: null, lessons: noModule });
  }

  for (const m of [...modules].sort((a, b) => a.order - b.order)) {
    const ms = byModule.get(m.id) ?? [];
    if (ms.length > 0) {
      groups.push({ id: m.id, title: m.title, summary: m.summary, lessons: ms });
    }
  }

  return groups;
}
