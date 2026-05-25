"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { createPortal } from "react-dom";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ImageIcon,
  Lock,
  Pencil,
  Play,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useConstructUrl } from "@/hooks/use-construct-url";

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface BoardLesson {
  id: string;
  title: string;
  moduleId: string | null;
  order: number;
  thumbnailKey?: string | null;
  isFreePreview: boolean;
  durationMin: number | null;
  awardSp: number;
  video: { provider: string | null };
}

export interface BoardModule {
  id: string;
  title: string;
  summary: string | null;
  order: number;
}

interface Group {
  id: string | null; // null = aulas avulsas
  title: string | null;
  summary: string | null;
  lessons: BoardLesson[];
}

interface Props {
  courseId: string;
  modules: BoardModule[];
  lessons: BoardLesson[];
  onEditLesson: (lesson: BoardLesson) => void;
  onDeleteLesson: (lesson: { id: string; title: string }) => void;
  onEditModule: (module: BoardModule) => void;
}

// ID sentinel pro "sem módulo" — null não pode ser usado como id de dnd-kit.
const NO_MODULE = "__no_module__";

// Prefixos pra distinguir tipos no DndContext.
const LESSON_PREFIX = "lesson::";
const GROUP_PREFIX = "group::";
const MODULE_PREFIX = "module::";

function buildGroups(modules: BoardModule[], lessons: BoardLesson[]): Group[] {
  const byModule = new Map<string | null, BoardLesson[]>();
  for (const l of lessons) {
    const arr = byModule.get(l.moduleId) ?? [];
    arr.push(l);
    byModule.set(l.moduleId, arr);
  }
  for (const arr of byModule.values()) arr.sort((a, b) => a.order - b.order);

  const groups: Group[] = [];

  // "Aulas avulsas" sempre no topo, mas só renderiza se tiver aulas.
  const orphan = byModule.get(null) ?? [];
  if (orphan.length > 0) {
    groups.push({ id: null, title: null, summary: null, lessons: orphan });
  }

  for (const m of [...modules].sort((a, b) => a.order - b.order)) {
    groups.push({
      id: m.id,
      title: m.title,
      summary: m.summary,
      lessons: byModule.get(m.id) ?? [],
    });
  }
  return groups;
}

// ── Componente principal ──────────────────────────────────────────────────

export function LessonsBoard({
  courseId,
  modules,
  lessons,
  onEditLesson,
  onDeleteLesson,
  onEditModule,
}: Props) {
  const qc = useQueryClient();
  const [groups, setGroups] = useState<Group[]>(() =>
    buildGroups(modules, lessons),
  );
  const isDraggingRef = useRef(false);
  const [activeDrag, setActiveDrag] = useState<
    | { kind: "lesson"; lesson: BoardLesson; index: number }
    | { kind: "module"; group: Group }
    | null
  >(null);

  // Accordion controlado: auto-expande novos módulos sem reabrir os que o
  // usuário fechou explicitamente. Funciona observando a diferença entre
  // groups atuais e o último estado conhecido — adiciona novos ids sem
  // remover os já presentes.
  const [openValues, setOpenValues] = useState<string[]>(() =>
    groups.map((g) => g.id ?? NO_MODULE),
  );
  const prevGroupIdsRef = useRef<Set<string>>(
    new Set(groups.map((g) => g.id ?? NO_MODULE)),
  );
  useEffect(() => {
    const currentIds = new Set(groups.map((g) => g.id ?? NO_MODULE));
    const newOnes: string[] = [];
    for (const id of currentIds) {
      if (!prevGroupIdsRef.current.has(id)) newOnes.push(id);
    }
    if (newOnes.length > 0) {
      setOpenValues((prev) => [...new Set([...prev, ...newOnes])]);
    }
    prevGroupIdsRef.current = currentIds;
  }, [groups]);

  // Re-sincroniza ao receber dados novos do servidor (e fora do drag).
  useEffect(() => {
    if (isDraggingRef.current) return;
    setGroups(buildGroups(modules, lessons));
  }, [modules, lessons]);

  const reorderLessons = useMutation({
    ...orpc.nasaRoute.creatorReorderLessons.mutationOptions(),
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao reordenar aulas.");
      setGroups(buildGroups(modules, lessons));
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({
          input: { courseId },
        }),
      });
    },
  });

  const reorderModules = useMutation({
    ...orpc.nasaRoute.creatorReorderModules.mutationOptions(),
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao reordenar módulos.");
      setGroups(buildGroups(modules, lessons));
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({
          input: { courseId },
        }),
      });
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // IDs sortable dos módulos reais (exclui "no-module" — fica fora do
  // SortableContext de módulos, pinado no topo).
  const sortableModuleIds = useMemo(
    () =>
      groups
        .filter((g) => g.id !== null)
        .map((g) => `${MODULE_PREFIX}${g.id}`),
    [groups],
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const findGroupOfLesson = (lessonId: string): Group | undefined =>
    groups.find((g) => g.lessons.some((l) => l.id === lessonId));

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    if (!activeId.startsWith(LESSON_PREFIX)) return;

    const lessonId = activeId.slice(LESSON_PREFIX.length);
    const fromGroup = findGroupOfLesson(lessonId);
    if (!fromGroup) return;

    // Determina o grupo destino.
    let toGroupKey: string | null | undefined;
    if (overId.startsWith(GROUP_PREFIX)) {
      const raw = overId.slice(GROUP_PREFIX.length);
      toGroupKey = raw === NO_MODULE ? null : raw;
    } else if (overId.startsWith(LESSON_PREFIX)) {
      const overLessonId = overId.slice(LESSON_PREFIX.length);
      const overGroup = findGroupOfLesson(overLessonId);
      toGroupKey = overGroup?.id;
    }
    if (toGroupKey === undefined) return;
    if (fromGroup.id === toGroupKey) return; // reorder dentro do mesmo grupo

    // Move aula pro grupo destino (no fim).
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, lessons: [...g.lessons] }));
      const from = next.find((g) => g.id === fromGroup.id);
      let to = next.find((g) => g.id === toGroupKey);
      // Cria o grupo "Aulas avulsas" se não existir ainda.
      if (!to && toGroupKey === null) {
        to = { id: null, title: null, summary: null, lessons: [] };
        next.unshift(to);
      }
      if (!from || !to) return prev;
      const idx = from.lessons.findIndex((l) => l.id === lessonId);
      if (idx < 0) return prev;
      const [moved] = from.lessons.splice(idx, 1);
      to.lessons.push({ ...moved, moduleId: toGroupKey ?? null });
      return next;
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    const id = String(event.active.id);
    if (id.startsWith(LESSON_PREFIX)) {
      const lessonId = id.slice(LESSON_PREFIX.length);
      for (const g of groups) {
        const idx = g.lessons.findIndex((l) => l.id === lessonId);
        if (idx >= 0) {
          setActiveDrag({ kind: "lesson", lesson: g.lessons[idx], index: idx });
          return;
        }
      }
    } else if (id.startsWith(MODULE_PREFIX)) {
      const modId = id.slice(MODULE_PREFIX.length);
      const g = groups.find((g) => g.id === modId);
      if (g) setActiveDrag({ kind: "module", group: g });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    isDraggingRef.current = false;
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // ── Reorder de módulos ────────────────────────────────────────────────
    if (activeId.startsWith(MODULE_PREFIX) && overId.startsWith(MODULE_PREFIX)) {
      const fromId = activeId.slice(MODULE_PREFIX.length);
      const toId = overId.slice(MODULE_PREFIX.length);
      if (fromId === toId) return;

      const orderedModuleIds = groups
        .filter((g) => g.id !== null)
        .map((g) => g.id as string);
      const oldIdx = orderedModuleIds.indexOf(fromId);
      const newIdx = orderedModuleIds.indexOf(toId);
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(orderedModuleIds, oldIdx, newIdx);

      setGroups((prev) => {
        const orphan = prev.find((g) => g.id === null);
        const byId = new Map(prev.filter((g) => g.id).map((g) => [g.id, g]));
        const next: Group[] = [];
        if (orphan) next.push(orphan);
        for (const id of reordered) {
          const g = byId.get(id);
          if (g) next.push(g);
        }
        return next;
      });

      reorderModules.mutate({
        courseId,
        modules: reordered.map((id, i) => ({ id, order: i })),
      });
      return;
    }

    // ── Reorder/move de aulas ─────────────────────────────────────────────
    if (activeId.startsWith(LESSON_PREFIX)) {
      const lessonId = activeId.slice(LESSON_PREFIX.length);

      // Determina grupo destino + posição.
      let destGroupKey: string | null | undefined;
      let overLessonId: string | null = null;
      if (overId.startsWith(LESSON_PREFIX)) {
        overLessonId = overId.slice(LESSON_PREFIX.length);
        const overGroup = findGroupOfLesson(overLessonId);
        destGroupKey = overGroup?.id;
      } else if (overId.startsWith(GROUP_PREFIX)) {
        const raw = overId.slice(GROUP_PREFIX.length);
        destGroupKey = raw === NO_MODULE ? null : raw;
      }
      if (destGroupKey === undefined) return;

      // Aplica reorder local dentro do grupo destino (cross-group já foi
      // tratado no onDragOver).
      const nextGroups = groups.map((g) => ({ ...g, lessons: [...g.lessons] }));
      const destGroup = nextGroups.find((g) => g.id === destGroupKey);
      if (!destGroup) return;
      const fromIdx = destGroup.lessons.findIndex((l) => l.id === lessonId);
      if (fromIdx < 0) return;
      let toIdx = destGroup.lessons.length - 1;
      if (overLessonId) {
        const overIdx = destGroup.lessons.findIndex(
          (l) => l.id === overLessonId,
        );
        if (overIdx >= 0) toIdx = overIdx;
      }
      if (fromIdx !== toIdx) {
        destGroup.lessons = arrayMove(destGroup.lessons, fromIdx, toIdx);
      }
      setGroups(nextGroups);

      // Persiste: payload com todas as aulas dos grupos afetados.
      const affected: Array<{
        id: string;
        order: number;
        moduleId: string | null;
      }> = [];
      for (const g of nextGroups) {
        g.lessons.forEach((l, i) => {
          affected.push({ id: l.id, order: i, moduleId: g.id });
        });
      }
      reorderLessons.mutate({ courseId, lessons: affected });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <p className="text-sm font-medium">
          Adicione sua primeira aula para começar
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Você pode agrupar aulas em módulos opcionais.
        </p>
      </div>
    );
  }

  const orphan = groups.find((g) => g.id === null);
  const realModules = groups.filter((g) => g.id !== null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        isDraggingRef.current = false;
        setActiveDrag(null);
        setGroups(buildGroups(modules, lessons));
      }}
    >
      <Accordion
        type="multiple"
        value={openValues}
        onValueChange={setOpenValues}
        className="space-y-3"
      >
        {/* Aulas avulsas: sempre no topo, não reordenável como grupo. */}
        {orphan && (
          <OrphanGroup
            group={orphan}
            onEditLesson={onEditLesson}
            onDeleteLesson={onDeleteLesson}
          />
        )}

        <SortableContext
          items={sortableModuleIds}
          strategy={verticalListSortingStrategy}
        >
          {realModules.map((group) => (
            <SortableModuleGroup
              key={group.id as string}
              group={group}
              onEditLesson={onEditLesson}
              onDeleteLesson={onDeleteLesson}
              onEditModule={onEditModule}
            />
          ))}
        </SortableContext>
      </Accordion>

      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={null}>
            {activeDrag?.kind === "lesson" && (
              <LessonOverlayCard
                lesson={activeDrag.lesson}
                index={activeDrag.index}
              />
            )}
            {activeDrag?.kind === "module" && (
              <ModuleOverlayCard group={activeDrag.group} />
            )}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

// ── Overlays (visual flutuante durante o drag) ────────────────────────────

function LessonOverlayCard({
  lesson,
  index,
}: {
  lesson: BoardLesson;
  index: number;
}) {
  const thumbUrl = useConstructUrl(lesson.thumbnailKey || "");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-violet-400 bg-card px-5 py-3 shadow-2xl ring-2 ring-violet-400/30">
      <GripVertical className="size-4 text-muted-foreground/60" />
      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {index + 1}
      </div>
      <div className="relative h-8 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted">
        {lesson.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={lesson.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-3 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{lesson.title}</p>
      </div>
    </div>
  );
}

function ModuleOverlayCard({ group }: { group: Group }) {
  return (
    <div className="rounded-2xl border border-violet-400 bg-card px-5 py-3 shadow-2xl ring-2 ring-violet-400/30">
      <div className="flex items-center gap-2">
        <GripVertical className="size-4 text-muted-foreground/60" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Módulo
          </p>
          <p className="truncate text-sm font-semibold">{group.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {group.lessons.length}{" "}
            {group.lessons.length === 1 ? "aula" : "aulas"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────

function OrphanGroup({
  group,
  onEditLesson,
  onDeleteLesson,
}: {
  group: Group;
  onEditLesson: Props["onEditLesson"];
  onDeleteLesson: Props["onDeleteLesson"];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${GROUP_PREFIX}${NO_MODULE}`,
  });

  return (
    <AccordionItem
      ref={setNodeRef}
      value={NO_MODULE}
      className={`overflow-hidden rounded-2xl border border-border bg-card transition-colors ${
        isOver ? "border-violet-400 ring-2 ring-violet-400/30" : ""
      }`}
    >
      <AccordionTrigger className="px-5 py-3 hover:no-underline">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aulas avulsas
            </p>
            <p className="text-[11px] text-muted-foreground">
              {group.lessons.length}{" "}
              {group.lessons.length === 1 ? "aula" : "aulas"}
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        <LessonsList
          group={group}
          onEditLesson={onEditLesson}
          onDeleteLesson={onDeleteLesson}
        />
      </AccordionContent>
    </AccordionItem>
  );
}

function SortableModuleGroup({
  group,
  onEditLesson,
  onDeleteLesson,
  onEditModule,
}: {
  group: Group;
  onEditLesson: Props["onEditLesson"];
  onDeleteLesson: Props["onDeleteLesson"];
  onEditModule: Props["onEditModule"];
}) {
  const moduleId = group.id as string;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${MODULE_PREFIX}${moduleId}`,
    data: { type: "Module" },
  });

  // Droppable separado pro container do módulo (aceita aulas).
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${GROUP_PREFIX}${moduleId}`,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <AccordionItem
      ref={setNodeRef}
      value={moduleId}
      style={style}
      className={`overflow-hidden rounded-2xl border border-border bg-card transition-colors ${
        isOver ? "border-violet-400 ring-2 ring-violet-400/30" : ""
      }`}
    >
      <div ref={setDropRef}>
        <AccordionTrigger className="px-5 py-3 hover:no-underline">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {/* Handle dedicado pra arrastar o módulo. NÃO pode ser <button>
                  porque o AccordionTrigger já é um <button> — hidratação
                  reclama de nested buttons. */}
              <span
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                aria-label="Arrastar módulo"
                className="cursor-grab touch-none rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Módulo
                </p>
                <p className="truncate text-sm font-semibold">{group.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {group.lessons.length}{" "}
                  {group.lessons.length === 1 ? "aula" : "aulas"}
                </p>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="shrink-0 inline-flex items-center justify-center rounded-md size-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onEditModule({
                  id: moduleId,
                  title: group.title ?? "",
                  summary: group.summary,
                  order: 0,
                });
              }}
            >
              <Settings2 className="size-4" />
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <LessonsList
            group={group}
            onEditLesson={onEditLesson}
            onDeleteLesson={onDeleteLesson}
          />
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}

function LessonsList({
  group,
  onEditLesson,
  onDeleteLesson,
}: {
  group: Group;
  onEditLesson: Props["onEditLesson"];
  onDeleteLesson: Props["onDeleteLesson"];
}) {
  const ids = group.lessons.map((l) => `${LESSON_PREFIX}${l.id}`);

  if (group.lessons.length === 0) {
    return (
      <div className="mx-4 my-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-5 py-6 text-center text-xs text-muted-foreground">
        Nenhuma aula neste módulo ainda — arraste uma aula pra cá ou crie uma
        nova.
      </div>
    );
  }

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul className="divide-y divide-border border-t border-border">
        {group.lessons.map((lesson, i) => (
          <SortableLessonRow
            key={lesson.id}
            lesson={lesson}
            index={i}
            onEdit={() => onEditLesson(lesson)}
            onDelete={() =>
              onDeleteLesson({ id: lesson.id, title: lesson.title })
            }
          />
        ))}
      </ul>
    </SortableContext>
  );
}

function SortableLessonRow({
  lesson,
  index,
  onEdit,
  onDelete,
}: {
  lesson: BoardLesson;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${LESSON_PREFIX}${lesson.id}`,
    data: { type: "Lesson", moduleId: lesson.moduleId },
  });

  const thumbUrl = useConstructUrl(lesson.thumbnailKey || "");

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-card px-5 py-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar aula"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground/40 hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {index + 1}
      </div>
      <div className="relative h-8 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted">
        {lesson.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={lesson.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-3 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{lesson.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {lesson.isFreePreview ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-semibold uppercase text-[10px] tracking-wide text-emerald-700 dark:text-emerald-400">
              <Play className="size-2.5" fill="currentColor" />
              Grátis
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5">
              <Lock className="size-2.5" />
              Bloqueada
            </span>
          )}
          {lesson.video.provider && (
            <span className="capitalize">· {lesson.video.provider}</span>
          )}
          {lesson.durationMin && <span>· {lesson.durationMin}min</span>}
          <span>· {lesson.awardSp} SP</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit} title="Editar aula">
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
        title="Excluir aula"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
