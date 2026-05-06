"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import { ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import {
  buildVariableHolidays,
  getHoliday,
  getMobilizationEvent,
} from "@/features/public-calendar/utils/holidays";
import { useUpdateAction } from "@/features/actions/hooks/use-tasks";

dayjs.locale("pt-br");


export interface WorkspaceCalendarAction {
  id: string;
  title: string;
  dueDate: Date | string | null;
  startDate: Date | string | null;
  endDate?: Date | string | null;
  priority?: string | null;
  isDone?: boolean;
  coverImage?: string | null;
  workspaceId?: string | null;
  workspace?: {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    coverImage?: string | null;
  } | null;
  // Cliente/Projeto (entidade unificada — type "client" | "project" | "entity")
  orgProjectId?: string | null;
  orgProject?: {
    id: string;
    name: string;
    type?: string | null;
    color?: string | null;
    avatar?: string | null;
  } | null;
  // Tracking (pipeline/funil)
  trackingId?: string | null;
  tracking?: { id: string; name: string } | null;
  // Lead específico
  leadId?: string | null;
  lead?: { id: string; name: string; email?: string | null } | null;
  createdBy?: string;
  user?: { id: string; name: string; image?: string | null } | null;
  participants?: Array<{
    userId: string;
    user?: { id: string; name: string; image?: string | null } | null;
  }>;
  responsibles?: Array<{
    userId: string;
    user?: { id: string; name: string; image?: string | null } | null;
  }>;
}

interface MonthGridProps {
  actions: WorkspaceCalendarAction[];
  workspaceColorMap: Record<string, string>;
  cursor: Dayjs;
  onCursorChange: (cursor: Dayjs) => void;
  onSelect: (action: WorkspaceCalendarAction) => void;
  selectedId?: string | null;
  /** Click em área vazia da célula. Recebe o dia clicado. */
  onCreateForDate?: (date: Dayjs) => void;
  /** Quando informado, mostra ícone de "+" no hover da célula. */
  showCreateOnHover?: boolean;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_VISIBLE = 4;
const CARD_HEIGHT = 52;
const CARD_GAP = 5;
const CELL_PADDING = 5;
const PLUS_MORE_HEIGHT = 25;
const EMPTY_ROW_HEIGHT = 56;

function isEmoji(value?: string | null): value is string {
  return !!value && !value.startsWith("http") && !value.startsWith("/") && value.length <= 4;
}

/** Drop zone transparente que ocupa todo o cell — registra `useDroppable`
 *  com id "day-YYYY-MM-DD". Quando um card é dropado dentro do cell,
 *  o handler `onDragEnd` recebe `over.id = "day-YYYY-MM-DD"`. */
function DropZone({ dayKey }: { dayKey: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "pointer-events-none absolute inset-0 z-0 rounded-lg transition-colors",
        isOver && "bg-primary/15 ring-2 ring-primary/60",
      )}
    />
  );
}

function MiniCard({
  action,
  color,
  selected,
  onSelect,
  draggable = false,
}: {
  action: WorkspaceCalendarAction;
  color: string;
  selected: boolean;
  onSelect: (a: WorkspaceCalendarAction) => void;
  draggable?: boolean;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [wsCoverFailed, setWsCoverFailed] = useState(false);
  const [creatorImgFailed, setCreatorImgFailed] = useState(false);

  // DnD — só ativa quando draggable=true (evita custo em modos não-drag)
  const drag = useDraggable({
    id: `action-${action.id}`,
    data: { action },
    disabled: !draggable,
  });

  const dateStr = action.dueDate || action.startDate;
  const time = dateStr ? dayjs(dateStr).format("HH:mm") : "";

  // Fallback chain: action.coverImage → workspace.coverImage → creator avatar → emoji/cor
  const actionCover =
    action.coverImage && !coverFailed ? imgSrc(action.coverImage) : null;
  const workspaceCover =
    !actionCover && action.workspace?.coverImage && !wsCoverFailed
      ? imgSrc(action.workspace.coverImage)
      : null;
  const creatorAvatar =
    !actionCover && !workspaceCover && action.user?.image && !creatorImgFailed
      ? imgSrc(action.user.image)
      : null;
  const wsEmoji = !actionCover && !workspaceCover && !creatorAvatar
    ? (isEmoji(action.workspace?.icon) ? action.workspace?.icon : null)
    : null;

  return (
    <button
      ref={draggable ? drag.setNodeRef : undefined}
      type="button"
      onClick={(e) => {
        // Não dispara onSelect durante drag (drag-kit já bloqueia o click no fim)
        if (drag.isDragging) {
          e.preventDefault();
          return;
        }
        onSelect(action);
      }}
      {...(draggable ? drag.attributes : {})}
      {...(draggable ? drag.listeners : {})}
      className={cn(
        "group relative h-[52px] w-full overflow-hidden rounded-md transition",
        selected ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/60",
        draggable && "cursor-grab active:cursor-grabbing",
        drag.isDragging && "opacity-40",
      )}
      style={{
        backgroundColor: color,
        // Quando em drag, deixamos o DragOverlay renderizar o "fantasma" — só
        // baixamos a opacidade aqui pra dar feedback visual.
      }}
      title={action.title}
    >
      {/* Camada de fallback SEMPRE presente: gradient + inicial grande.
          Garante que mesmo sem imagem o card tenha visual bonito. As imagens
          (quando existem) renderizam por cima. */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}80 100%)`,
        }}
      >
        <span className="text-2xl font-bold text-white/30 select-none">
          {action.title.charAt(0).toUpperCase()}
        </span>
      </div>

      {actionCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={actionCover}
          alt={action.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : workspaceCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={workspaceCover}
          alt={action.workspace?.name ?? ""}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          onError={() => setWsCoverFailed(true)}
        />
      ) : creatorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creatorAvatar}
          alt={action.user?.name ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCreatorImgFailed(true)}
        />
      ) : wsEmoji ? (
        <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-60">
          {wsEmoji}
        </div>
      ) : null}

      {/* Banner inferior com título + horário */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-1.5 pb-1 pt-6">
        <div className="truncate text-[9px] font-bold leading-tight text-white drop-shadow">
          {action.isDone ? "✓ " : ""}
          {action.title}
        </div>
        {time && (
          <div className="text-[8px] font-medium text-white/90">{time}</div>
        )}
      </div>

      {/* Workspace tag no topo esquerdo */}
      {action.workspace?.name && (
        <div className="absolute left-1.5 top-1.5 max-w-[60%] truncate rounded bg-black/60 px-1 py-0.5 text-[8px] font-semibold text-white backdrop-blur-sm">
          {action.workspace.name}
        </div>
      )}

      {/* Cliente/Projeto (orgProject) ou Lead — topo direito */}
      {action.orgProject?.name ? (
        <div
          className="absolute right-1.5 top-1.5 max-w-[55%] truncate rounded px-1 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm"
          style={{
            backgroundColor: action.orgProject.color
              ? `${action.orgProject.color}E6`
              : "rgba(0,0,0,0.6)",
          }}
          title={`${action.orgProject.type === "client" ? "Cliente" : "Projeto"}: ${action.orgProject.name}`}
        >
          {action.orgProject.type === "client" ? "👤 " : "📁 "}
          {action.orgProject.name}
        </div>
      ) : action.lead?.name ? (
        <div
          className="absolute right-1.5 top-1.5 max-w-[55%] truncate rounded bg-amber-500/80 px-1 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm"
          title={`Lead: ${action.lead.name}`}
        >
          👤 {action.lead.name}
        </div>
      ) : null}
    </button>
  );
}

export function WorkspaceCalendarMonthGrid({
  actions,
  workspaceColorMap,
  cursor,
  onCursorChange,
  onSelect,
  selectedId,
  onCreateForDate,
  showCreateOnHover,
}: MonthGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);

  // ── DnD: arrastar evento entre dias muda dueDate da action ───────────────
  const updateAction = useUpdateAction();
  const [draggingAction, setDraggingAction] =
    useState<WorkspaceCalendarAction | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const a = (e.active.data.current as { action?: WorkspaceCalendarAction })?.action;
    if (a) setDraggingAction(a);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingAction(null);
    const action = (e.active.data.current as { action?: WorkspaceCalendarAction })
      ?.action;
    const dropDayKey = e.over?.id as string | undefined;
    if (!action || !dropDayKey || !dropDayKey.startsWith("day-")) return;
    const targetDay = dropDayKey.slice(4); // "day-YYYY-MM-DD"

    // Não move se cair no mesmo dia (evita mutation desnecessária)
    const currentDate = action.dueDate || action.startDate;
    const currentKey = currentDate
      ? dayjs(currentDate).format("YYYY-MM-DD")
      : null;
    if (currentKey === targetDay) return;

    // Preserva o horário (HH:mm:ss) original quando mover
    const originalTime = currentDate
      ? dayjs(currentDate)
      : dayjs().hour(9).minute(0).second(0);
    const newDate = dayjs(targetDay)
      .hour(originalTime.hour())
      .minute(originalTime.minute())
      .second(originalTime.second())
      .toDate();

    updateAction.mutate(
      {
        actionId: action.id,
        dueDate: newDate,
      } as any,
      {
        onSuccess: () => {
          toast.success(
            `Movido para ${dayjs(targetDay).format("DD [de] MMMM")}`,
          );
        },
        onError: (err) => {
          toast.error(`Falha ao mover: ${(err as Error).message}`);
        },
      },
    );
  };

  const actionsByDay = useMemo(() => {
    const map = new Map<string, WorkspaceCalendarAction[]>();
    for (const a of actions) {
      const dateStr = a.dueDate || a.startDate;
      if (!dateStr) continue;
      const key = dayjs(dateStr).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [actions]);

  const grid = useMemo(() => {
    const startOfMonth = cursor.startOf("month");
    const firstDayOfGrid = startOfMonth.subtract(startOfMonth.day(), "day");
    const days: Dayjs[] = [];
    for (let i = 0; i < 42; i++) days.push(firstDayOfGrid.add(i, "day"));
    return days;
  }, [cursor]);

  const variableHolidays = useMemo(() => {
    const years = new Set(grid.map((d) => d.year()));
    return buildVariableHolidays(years);
  }, [grid]);

  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    for (let i = 0; i < grid.length; i += 7) {
      const row = grid.slice(i, i + 7);
      let maxCards = 0;
      let rowHasOverflow = false;
      for (const day of row) {
        const key = day.format("YYYY-MM-DD");
        const count = actionsByDay.get(key)?.length ?? 0;
        maxCards = Math.max(maxCards, Math.min(count, MAX_VISIBLE));
        if (count > MAX_VISIBLE) rowHasOverflow = true;
      }
      if (maxCards === 0) {
        heights.push(EMPTY_ROW_HEIGHT);
      } else {
        const base =
          2 * CELL_PADDING +
          maxCards * CARD_HEIGHT +
          (maxCards - 1) * CARD_GAP;
        heights.push(rowHasOverflow ? base + CARD_GAP + PLUS_MORE_HEIGHT : base);
      }
    }
    return heights;
  }, [grid, actionsByDay]);

  const today = dayjs().startOf("day");

  useEffect(() => {
    const isCurrentMonth = cursor.isSame(dayjs(), "month");
    if (!isCurrentMonth) return;

    const timer = setTimeout(() => {
      if (todayCellRef.current && gridRef.current) {
        const cell = todayCellRef.current;
        const container = gridRef.current;
        const cellRect = cell.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTarget =
          container.scrollTop + (cellRect.top - containerRect.top) - 4;
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [cursor]);

  const getColor = (a: WorkspaceCalendarAction) =>
    a.workspaceId ? workspaceColorMap[a.workspaceId] ?? "#7c3aed" : "#7c3aed";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingAction(null)}
    >
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xl font-bold capitalize">
          <span>{cursor.format("MMMM")}</span>
          <span className="ml-2 font-normal text-muted-foreground">
            {cursor.format("YYYY")}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onCursorChange(dayjs().startOf("month"))}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCursorChange(cursor.subtract(1, "month"))}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCursorChange(cursor.add(1, "month"))}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-3">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        className="grid flex-1 grid-cols-7 gap-1 overflow-auto px-3 pb-3"
        style={{
          gridTemplateRows: rowHeights.map((h) => `${h}px`).join(" "),
          alignContent: "start",
        }}
      >
        {grid.map((day) => {
          const dayKey = day.format("YYYY-MM-DD");
          const dayActions = actionsByDay.get(dayKey) ?? [];
          const isOutside = !day.isSame(cursor, "month");
          const isToday = day.isSame(today, "day");
          const overflow = dayActions.length - MAX_VISIBLE;
          const holiday = getHoliday(day, variableHolidays);
          const mobilization = getMobilizationEvent(day);
          const hasTopLabel = !!(holiday || mobilization);

          return (
            <div
              key={dayKey}
              ref={isToday ? todayCellRef : undefined}
              onClick={(e) => {
                // Só dispara em click na área vazia da célula — clicks em
                // cards / popovers / "+" param via stopPropagation neles.
                if (onCreateForDate && e.target === e.currentTarget) {
                  onCreateForDate(day);
                }
              }}
              className={cn(
                "group relative overflow-hidden rounded-lg",
                onCreateForDate && "cursor-pointer",
                isToday
                  ? "bg-primary/15 ring-1 ring-primary/40"
                  : isOutside
                    ? "bg-violet-500/8"
                    : "bg-card/60",
              )}
              style={{ padding: `${CELL_PADDING}px` }}
            >
              {/* Drop zone — registra useDroppable("day-YYYY-MM-DD") */}
              <DropZone dayKey={dayKey} />

              {/* Número do dia */}
              <div
                className={cn(
                  "pointer-events-none absolute left-[5px] top-[5px] z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-sm",
                  isToday && "bg-primary text-primary-foreground",
                  isOutside &&
                    !isToday &&
                    "bg-background/50 text-muted-foreground/50",
                  !isToday &&
                    !isOutside &&
                    "bg-background/85 text-foreground/90 backdrop-blur-sm",
                )}
              >
                {day.date()}
              </div>

              {/* Botão "+" pra criar evento (visível no hover) */}
              {showCreateOnHover && onCreateForDate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateForDate(day);
                  }}
                  title={`Criar evento em ${day.format("DD/MM/YYYY")}`}
                  className="absolute right-[5px] top-[5px] z-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity hover:scale-110 group-hover:opacity-100"
                >
                  <Plus className="size-3.5" />
                </button>
              )}

              {(holiday || mobilization) && (
                <div className="absolute left-0 right-0 top-[28px] z-20 flex flex-col gap-0.5 px-[5px]">
                  {[holiday, mobilization].filter(Boolean).map((ev, i) => (
                    <Popover key={i}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-opacity hover:opacity-80",
                            ev!.color === "amber"
                              ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                              : "bg-indigo-400/20 text-indigo-700 dark:text-indigo-300",
                          )}
                        >
                          {ev!.label}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start" side="right">
                        <div className="p-3 pb-2">
                          <p className="text-sm font-semibold leading-tight">{ev!.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{ev!.description}</p>
                        </div>
                        <div className={cn(
                          "mx-3 mb-2 rounded px-2 py-1.5 text-xs",
                          ev!.color === "amber"
                            ? "bg-amber-400/15 text-amber-800 dark:text-amber-300"
                            : "bg-indigo-400/15 text-indigo-800 dark:text-indigo-300",
                        )}>
                          <span className="font-semibold">Impacto: </span>{ev!.impact}
                        </div>
                        <div className="border-t px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dicas de ação</p>
                          <ul className="space-y-0.5">
                            {ev!.tips.map((tip, ti) => (
                              <li key={ti} className="flex gap-1.5 text-xs text-foreground/80">
                                <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              )}

              {dayActions.length > 0 && (
                <div
                  className="flex h-full flex-col"
                  style={{
                    gap: `${CARD_GAP}px`,
                    paddingTop: holiday && mobilization ? 68 : hasTopLabel ? 48 : 28,
                  }}
                >
                  {dayActions.slice(0, MAX_VISIBLE).map((a) => (
                    <MiniCard
                      key={a.id}
                      action={a}
                      color={getColor(a)}
                      selected={selectedId === a.id}
                      onSelect={onSelect}
                      draggable
                    />
                  ))}

                  {overflow > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          style={{ height: `${PLUS_MORE_HEIGHT}px` }}
                          className="w-full shrink-0 rounded bg-muted/50 px-2 text-[11px] font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground"
                        >
                          +{overflow} mais
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1" align="start">
                        <div className="flex flex-col gap-0.5">
                          {dayActions.slice(MAX_VISIBLE).map((a) => {
                            const t = a.dueDate || a.startDate;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => onSelect(a)}
                                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition hover:bg-muted"
                              >
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: getColor(a) }}
                                />
                                <span className="truncate font-medium">
                                  {a.isDone ? "✓ " : ""}
                                  {a.title}
                                </span>
                                {t && (
                                  <span className="ml-auto shrink-0 text-muted-foreground">
                                    {dayjs(t).format("HH:mm")}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* DragOverlay — fantasma do card durante o drag */}
    <DragOverlay>
      {draggingAction ? (
        <div className="pointer-events-none">
          <MiniCard
            action={draggingAction}
            color={getColor(draggingAction)}
            selected={false}
            onSelect={() => {}}
          />
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}

