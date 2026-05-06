"use client";

import Link from "next/link";
import { Lock, Play } from "lucide-react";

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
 * Mostra ícone de Play pra previews liberados, Lock pros bloqueados.
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
        {lessons.length} aulas · {freeCount} gratuitas
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
                  <p className="mt-0.5 text-xs text-muted-foreground">{group.summary}</p>
                )}
              </div>
            )}
            <ul className="divide-y divide-border">
              {group.lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    {l.isFreePreview ? (
                      <Play className="size-3.5 text-violet-600" />
                    ) : (
                      <Lock className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    {l.summary && (
                      <p className="truncate text-xs text-muted-foreground">{l.summary}</p>
                    )}
                  </div>
                  {l.durationMin && (
                    <span className="text-[11px] text-muted-foreground">
                      {l.durationMin} min
                    </span>
                  )}
                  {l.isFreePreview ? (
                    <Link
                      href={`/c/${companySlug}/${courseSlug}/preview/${l.id}`}
                      className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                    >
                      Assistir grátis
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="size-3" />
                      Bloqueado
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
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
