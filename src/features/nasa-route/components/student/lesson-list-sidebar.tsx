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
  /** Dentro da gaveta do celular: sem moldura e sem altura máxima própria. */
  isInSheet?: boolean;
}

export function LessonListSidebar({
  modules,
  lessons,
  activeLessonId,
  completedSet,
  onSelect,
  isInSheet = false,
}: Props) {
  const groups = groupLessonsByModule(modules, lessons);

  return (
    <aside className={cn("overflow-hidden", !isInSheet && "rounded-[20px] border border-line bg-card")}>
      <div className={cn("py-3", isInSheet ? "px-1" : "px-4")}>
        <h2 className="text-sm font-semibold">Aulas</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {completedSet.size} de {lessons.length} concluídas
        </p>
      </div>

      <div className={cn(!isInSheet && "max-h-[70vh] overflow-y-auto")}>
        {groups.map((group, groupIndex) => (
          <div key={group.id ?? "no-module"}>
            {group.title && (
              <div className="bg-muted/30 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Módulo {groupIndex + 1}
                </p>
                <p className="text-xs font-medium">{group.title}</p>
              </div>
            )}
            <ul className="divide-y divide-border">
              {group.lessons.map((lesson, lessonIndex) => {
                const completed = completedSet.has(lesson.id);
                const active = activeLessonId === lesson.id;
                const locked = lesson.includedInPlan === false;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(lesson.id)}
                      className={cn(
                        "flex min-h-12 w-full items-start gap-3 border-l-2 px-4 py-3 text-left text-sm transition hover:bg-muted",
                        active
                          ? "border-info bg-info/5"
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
                              ? "bg-success text-white"
                              : active
                                ? "bg-info text-white"
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
                          lessonIndex + 1
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-medium leading-tight",
                            active && "text-info",
                            locked && "text-muted-foreground",
                          )}
                        >
                          {lesson.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {lesson.durationMin && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="size-3" />
                              {lesson.durationMin}min
                            </span>
                          )}
                          {locked && (
                            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                              Não incluída
                            </span>
                          )}
                          {!locked && lesson.isFreePreview && (
                            <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
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

/** Ordem em que o aluno vê as aulas: soltas primeiro, depois por módulo. */
export function orderLessonsForPlayer<TLesson extends Lesson>(modules: ModuleInfo[], lessons: TLesson[]): TLesson[] {
  return groupLessonsByModule(modules, lessons).flatMap((group) => group.lessons);
}

function groupLessonsByModule<TLesson extends Lesson>(modules: ModuleInfo[], lessons: TLesson[]) {
  const lessonsByModule = new Map<string | null, TLesson[]>();
  for (const lesson of lessons) {
    const moduleLessons = lessonsByModule.get(lesson.moduleId) ?? [];
    moduleLessons.push(lesson);
    lessonsByModule.set(lesson.moduleId, moduleLessons);
  }
  for (const moduleLessons of lessonsByModule.values()) {
    moduleLessons.sort((first, second) => first.order - second.order);
  }

  const groups: Array<{
    id: string | null;
    title: string | null;
    summary: string | null;
    lessons: TLesson[];
  }> = [];

  const noModule = lessonsByModule.get(null) ?? [];
  if (noModule.length > 0) {
    groups.push({ id: null, title: null, summary: null, lessons: noModule });
  }

  for (const courseModule of [...modules].sort((first, second) => first.order - second.order)) {
    const moduleLessons = lessonsByModule.get(courseModule.id) ?? [];
    if (moduleLessons.length > 0) {
      groups.push({ id: courseModule.id, title: courseModule.title, summary: courseModule.summary, lessons: moduleLessons });
    }
  }

  return groups;
}
