"use client";

import { Check, Clock, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lesson {
  id: string;
  order: number;
  moduleId: string | null;
  title: string;
  durationMin: number | null;
  isFreePreview: boolean;
  includedInPlan?: boolean;
}

interface ModuleInfo {
  id: string;
  title: string;
  summary: string | null;
  order: number;
}

interface Props {
  modules: ModuleInfo[];
  lessons: Lesson[];
  activeLessonId: string | null;
  completedSet: Set<string>;
  onSelect: (lessonId: string) => void;
}

export function LessonListSidebar({
  modules,
  lessons,
  activeLessonId,
  completedSet,
  onSelect,
}: Props) {
  const groups = groupLessonsByModule(modules, lessons);

  return (
    <aside className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Aulas</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {completedSet.size} de {lessons.length} concluídas
        </p>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={group.id ?? "no-module"}>
            {group.title && (
              <div className="border-b border-border bg-muted/30 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Módulo {gi + 1}
                </p>
                <p className="text-xs font-medium">{group.title}</p>
              </div>
            )}
            <ul className="divide-y divide-border">
              {group.lessons.map((l, i) => {
                const completed = completedSet.has(l.id);
                const active = activeLessonId === l.id;
                const locked = l.includedInPlan === false;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(l.id)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left text-sm transition border-l-2 hover:bg-muted",
                        active
                          ? "border-violet-600 bg-violet-500/5"
                          : "border-transparent",
                        locked && "opacity-70",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          locked
                            ? "bg-muted text-muted-foreground"
                            : completed
                              ? "bg-emerald-500 text-white"
                              : active
                                ? "bg-violet-600 text-white"
                                : "bg-muted text-muted-foreground",
                        )}
                      >
                        {locked ? (
                          <Lock className="size-3" />
                        ) : completed ? (
                          <Check className="size-3" />
                        ) : active ? (
                          <Play className="size-3" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-medium leading-tight",
                            active && "text-violet-700 dark:text-violet-300",
                            locked && "text-muted-foreground",
                          )}
                        >
                          {l.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {l.durationMin && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="size-3" />
                              {l.durationMin}min
                            </span>
                          )}
                          {locked && (
                            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Não incluída
                            </span>
                          )}
                          {!locked && l.isFreePreview && (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              Preview
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

function groupLessonsByModule(modules: ModuleInfo[], lessons: Lesson[]) {
  const byModule = new Map<string | null, Lesson[]>();
  for (const l of lessons) {
    const arr = byModule.get(l.moduleId) ?? [];
    arr.push(l);
    byModule.set(l.moduleId, arr);
  }
  for (const arr of byModule.values()) {
    arr.sort((a, b) => a.order - b.order);
  }

  const groups: Array<{
    id: string | null;
    title: string | null;
    summary: string | null;
    lessons: Lesson[];
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
