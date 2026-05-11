"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import {
  ChevronsLeft,
  ChevronsRight,
  Plus,
  CalendarDays,
  FilterIcon,
  PersonStanding,
  MonitorSmartphone,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import {
  buildVariableHolidays,
  getHoliday,
  getMobilizationEvent,
} from "@/features/public-calendar/utils/holidays";
import { useRescheduleAppointment } from "../hooks/use-agenda";
import { CreateAppointmentModal } from "@/features/trackings/components/calendar/create-appointment-modal";
import { ViewAppointment } from "@/features/trackings/components/calendar/view-appointment";
import { AgendaEventList } from "./agenda-event-list";

dayjs.locale("pt-br");

const PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
];

// Status colour rings (border-l accent)
const STATUS_RING: Record<string, string> = {
  PENDING: "ring-yellow-400/70",
  CONFIRMED: "ring-emerald-400/70",
  CANCELLED: "ring-red-400/70",
  NO_SHOW: "ring-red-400/70",
  DONE: "ring-blue-400/70",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_VISIBLE = 10; // 10 cards antes de aparecer "+N mais"
const CARDS_PER_ROW = 2; // 2 cards por linha dentro do dia
const CARD_HEIGHT = 30; // altura fixa do card de agendamento
const CARD_GAP = 4; // gap horizontal e vertical entre cards
const CELL_PADDING = 5;
const PLUS_MORE_HEIGHT = 22;
const EMPTY_ROW_HEIGHT = 56;
const DAY_HEADER_OFFSET = 28; // espaço pro número do dia / botão "+"
const HOLIDAY_LABEL_HEIGHT = 20; // espaço extra de UM badge de feriado/mobilization

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeetingType = "ONLINE" | "IN_PERSON";

export interface AgendaAppointment {
  id: string;
  title: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
  meetingType?: MeetingType | null;
  agendaId: string;
  agenda?: { id: string; name: string } | null;
  lead?: { id: string; name: string; email?: string | null } | null;
  orgProject?: {
    id: string;
    name: string;
    type?: string | null;
    color?: string | null;
    avatar?: string | null;
  } | null;
}

interface AgendaSummary {
  id: string;
  name: string;
}

interface Props {
  agendas: AgendaSummary[];
  /** Lista de agendamentos a renderizar (escopo definido pelo parent — org, tracking, etc.). */
  appointments: AgendaAppointment[];
  /** Loading state da query externa. */
  isLoading?: boolean;
  /** Filtro inicial por agenda (client-side). "all" mostra todas. */
  defaultAgendaId?: string;
  /** Tracking pré-selecionado pra criação rápida (omite o step de tracking). */
  trackingId?: string;
  /** Pré-preenchimentos do agendamento criado via "+". */
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  onAppointmentCreated?: (appointmentId: string) => void;
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

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

// ─── Mini card ────────────────────────────────────────────────────────────────

function MiniCard({
  appt,
  color,
  selected,
  onSelect,
  draggable = false,
}: {
  appt: AgendaAppointment;
  color: string;
  selected: boolean;
  onSelect: (a: AgendaAppointment) => void;
  draggable?: boolean;
}) {
  const [coverFailed, setCoverFailed] = useState(false);

  const drag = useDraggable({
    id: `appt-${appt.id}`,
    data: { appt },
    disabled: !draggable,
  });

  const time = dayjs(appt.startsAt).format("HH:mm");
  const clientName =
    appt.lead?.name ||
    (appt.title ?? "").replace(/^agendamento:\s*/i, "") ||
    "Agendamento";

  const cover =
    appt.orgProject?.avatar && !coverFailed ? imgSrc(appt.orgProject.avatar) : null;

  const ringClass = STATUS_RING[appt.status] ?? "ring-slate-300/60";
  const isCancelled = appt.status === "CANCELLED";

  return (
    <button
      ref={draggable ? drag.setNodeRef : undefined}
      type="button"
      onClick={(e) => {
        if (drag.isDragging) {
          e.preventDefault();
          return;
        }
        onSelect(appt);
      }}
      {...(draggable ? drag.attributes : {})}
      {...(draggable ? drag.listeners : {})}
      className={cn(
        "group relative w-full overflow-hidden rounded-md transition shadow-sm",
        selected
          ? "ring-2 ring-primary"
          : `ring-1 ${ringClass} hover:ring-2 hover:ring-primary/60`,
        draggable && "cursor-grab active:cursor-grabbing",
        drag.isDragging && "opacity-40",
        // Cancelado: card 50% transparente
        isCancelled && !drag.isDragging && "opacity-50",
      )}
      style={{ backgroundColor: color, height: `${CARD_HEIGHT}px` }}
      title={`${time} ${clientName}${appt.agenda?.name ? ` · ${appt.agenda.name}` : ""}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}80 100%)`,
        }}
      />


      {cover && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={appt.orgProject?.name ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
          {/* Overlay escuro pra legibilidade do texto sobre imagens */}
          <div className="absolute inset-0 bg-black/40" />
        </>
      )}

      {/* Conteúdo centralizado verticalmente */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-0.5 px-1.5 text-center">
        <div
          className={cn(
            "w-full truncate text-left text-[9px] font-bold leading-none text-white drop-shadow",
            isCancelled && "line-through decoration-white/80 decoration-[1px]",
          )}
        >
          {clientName}
        </div>
        <div className="flex w-full items-center justify-center gap-1.5 leading-none">
          <span className="text-[9px] font-semibold text-white/95">{time}</span>
          {appt.agenda?.name && (
            <span
              className="truncate text-[8px] font-light text-white/75"
              title={appt.agenda.name}
            >
              · {appt.agenda.name}
            </span>
          )}
        </div>
      </div>

      {/* Cliente/projeto — canto superior direito (badge minúsculo) */}
      {appt.orgProject?.name && (
        <div
          className="absolute right-0.5 top-0.5 z-20 max-w-[50%] truncate rounded px-0.5 py-px text-[6.5px] font-bold text-white backdrop-blur-sm"
          style={{
            backgroundColor: appt.orgProject.color
              ? `${appt.orgProject.color}E6`
              : "rgba(0,0,0,0.6)",
          }}
          title={appt.orgProject.name}
        >
          {appt.orgProject.type === "client" ? "👤" : "📁"} {appt.orgProject.name}
        </div>
      )}

      {/* Ícone de tipo de reunião — entra pela direita do card.
          30px de tamanho, 60% visível dentro (40% para fora, cortado pelo
          overflow-hidden do card). Branco, 70% de opacidade. */}
      {(() => {
        const type = appt.meetingType ?? "ONLINE";
        const Icon = type === "IN_PERSON" ? PersonStanding : MonitorSmartphone;
        const label = type === "IN_PERSON" ? "Presencial" : "On-line";
        return (
          <Icon
            aria-label={label}
            className="pointer-events-none absolute top-1/2 z-[5] -translate-y-1/2 text-white opacity-30"
            style={{ width: 30, height: 30, right: -12 }}
          />
        );
      })()}
    </button>
  );
}

// ─── Main grid component ──────────────────────────────────────────────────────

export function AgendaMonthCalendar({
  agendas,
  appointments: rawAppointments,
  isLoading,
  defaultAgendaId,
  trackingId,
  leadName,
  leadPhone,
  leadEmail,
  onAppointmentCreated,
}: Props) {
  const [cursor, setCursor] = useState<Dayjs>(dayjs().startOf("month"));
  const [agendaId, setAgendaId] = useState<string>(defaultAgendaId ?? "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filtro client-side por agenda (sem refetch — a fonte é o parent)
  const appointments = useMemo(() => {
    if (agendaId === "all") return rawAppointments;
    return rawAppointments.filter((a) => a.agendaId === agendaId);
  }, [rawAppointments, agendaId]);
  const reschedule = useRescheduleAppointment();

  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date>();
  const [viewId, setViewId] = useState<string>("");
  const [viewOpen, setViewOpen] = useState(false);

  const openAppointment = useCallback((id: string) => {
    setViewId(id);
    setViewOpen(true);
  }, []);

  const closeAppointment = useCallback(() => {
    setViewOpen(false);
    setTimeout(() => setViewId(""), 300);
  }, []);

  const gridRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);

  // ── Color map (por agenda) ───────────────────────────────────────────────
  const agendaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    agendas.forEach((a, i) => {
      map[a.id] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [agendas]);

  // ── DnD setup ────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const [draggingAppt, setDraggingAppt] = useState<AgendaAppointment | null>(
    null,
  );

  const handleDragStart = (e: DragStartEvent) => {
    const a = (e.active.data.current as { appt?: AgendaAppointment })?.appt;
    if (a) setDraggingAppt(a);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingAppt(null);
    const appt = (e.active.data.current as { appt?: AgendaAppointment })?.appt;
    const dropDayKey = e.over?.id as string | undefined;
    if (!appt || !dropDayKey || !dropDayKey.startsWith("day-")) return;
    const targetDay = dropDayKey.slice(4);

    const currentKey = dayjs(appt.startsAt).format("YYYY-MM-DD");
    if (currentKey === targetDay) return;

    const original = dayjs(appt.startsAt);
    const duration = dayjs(appt.endsAt).diff(dayjs(appt.startsAt));
    const newStart = dayjs(targetDay)
      .hour(original.hour())
      .minute(original.minute())
      .second(original.second())
      .millisecond(0)
      .toDate();
    const newEnd = new Date(newStart.getTime() + duration);

    toast.promise(
      new Promise<void>((resolve, reject) => {
        reschedule.mutate(
          {
            appointmentId: appt.id,
            startsAt: newStart.toISOString(),
            endsAt: newEnd.toISOString(),
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      }),
      {
        loading: "Reagendando...",
        success: `Movido para ${dayjs(targetDay).format("DD [de] MMMM")}`,
        error: (err: Error) => `Erro: ${err.message}`,
      },
    );
  };

  // ── Index appointments by day ────────────────────────────────────────────
  const apptsByDay = useMemo(() => {
    const map = new Map<string, AgendaAppointment[]>();
    for (const a of appointments as AgendaAppointment[]) {
      const key = dayjs(a.startsAt).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    // sort each day por horário
    for (const arr of map.values()) {
      arr.sort(
        (x, y) =>
          new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime(),
      );
    }
    return map;
  }, [appointments]);

  // ── Build 6×7 grid ───────────────────────────────────────────────────────
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
      // Maior nº de "linhas internas de cards" entre os dias dessa linha do mês.
      // Com CARDS_PER_ROW=2 cards por linha → linhas internas = ceil(count / 2).
      let maxCardLines = 0;
      let rowHasOverflow = false;
      let maxTopOffset = DAY_HEADER_OFFSET;
      for (const day of row) {
        const key = day.format("YYYY-MM-DD");
        const count = apptsByDay.get(key)?.length ?? 0;
        const visible = Math.min(count, MAX_VISIBLE);
        const lines = Math.ceil(visible / CARDS_PER_ROW);
        if (lines > maxCardLines) maxCardLines = lines;
        if (count > MAX_VISIBLE) rowHasOverflow = true;
        if (count > 0) {
          const holiday = getHoliday(day, variableHolidays);
          const mobilization = getMobilizationEvent(day);
          const labels = (holiday ? 1 : 0) + (mobilization ? 1 : 0);
          const offset = DAY_HEADER_OFFSET + labels * HOLIDAY_LABEL_HEIGHT;
          if (offset > maxTopOffset) maxTopOffset = offset;
        }
      }
      if (maxCardLines === 0) {
        heights.push(EMPTY_ROW_HEIGHT);
      } else {
        const base =
          2 * CELL_PADDING +
          maxCardLines * CARD_HEIGHT +
          (maxCardLines - 1) * CARD_GAP +
          maxTopOffset;
        heights.push(rowHasOverflow ? base + CARD_GAP + PLUS_MORE_HEIGHT : base);
      }
    }
    return heights;
  }, [grid, apptsByDay, variableHolidays]);

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

  const getColor = (a: AgendaAppointment) =>
    agendaColorMap[a.agendaId] ?? PALETTE[0];

  const handleSelect = useCallback(
    (a: AgendaAppointment) => {
      setSelectedId(a.id);
      openAppointment(a.id);
    },
    [openAppointment],
  );

  const handleCreateForDate = (d: Dayjs) => {
    setCreateInitialDate(d.hour(9).minute(0).second(0).toDate());
    setCreateOpen(true);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingAppt(null)}
      >
        <div className="flex h-full flex-col">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
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
                  onClick={() => setCursor(dayjs().startOf("month"))}
                >
                  Hoje
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCursor(cursor.subtract(1, "month"))}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCursor(cursor.add(1, "month"))}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={agendaId} onValueChange={setAgendaId}>
                <SelectTrigger className="h-8 w-full min-w-[180px] sm:w-48 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FilterIcon className="size-3 shrink-0" />
                    <SelectValue placeholder="Agenda" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as agendas</SelectItem>
                  {agendas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={() => {
                  setCreateInitialDate(new Date());
                  setCreateOpen(true);
                }}
              >
                <Plus className="size-4" />
                Novo compromisso
              </Button>
            </div>
          </div>

          {/* Weekday headers — só no desktop (mobile usa lista) */}
          <div className="hidden grid-cols-7 px-3 lg:grid">
            {WEEKDAYS.map((d, i) => (
              <div
                key={i}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Mobile: lista de eventos do mês (padrão Workspace Calendário) */}
          <div className="flex min-h-0 flex-1 flex-col lg:hidden">
            <AgendaEventList
              appointments={
                (appointments as AgendaAppointment[]).filter((a) =>
                  dayjs(a.startsAt).isSame(cursor, "month"),
                )
              }
              agendaColorMap={agendaColorMap}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>

          {/* Desktop: grid mensal */}
          <div
            ref={gridRef}
            className="hidden flex-1 grid-cols-7 gap-1 overflow-auto px-3 pb-3 lg:grid"
            style={{
              gridTemplateRows: rowHeights.map((h) => `${h}px`).join(" "),
              alignContent: "start",
            }}
          >
            {grid.map((day) => {
              const dayKey = day.format("YYYY-MM-DD");
              const dayAppts = apptsByDay.get(dayKey) ?? [];
              const isOutside = !day.isSame(cursor, "month");
              const isToday = day.isSame(today, "day");
              const overflow = dayAppts.length - MAX_VISIBLE;
              const holiday = getHoliday(day, variableHolidays);
              const mobilization = getMobilizationEvent(day);

              return (
                <div
                  key={dayKey}
                  ref={isToday ? todayCellRef : undefined}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) handleCreateForDate(day);
                  }}
                  className={cn(
                    "group relative cursor-pointer overflow-hidden rounded-lg",
                    isToday
                      ? "bg-primary/15 ring-1 ring-primary/40"
                      : isOutside
                        ? "bg-violet-500/8"
                        : "bg-card/60",
                  )}
                  style={{ padding: `${CELL_PADDING}px` }}
                >
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

                  {/* Botão "+" pra criar evento */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateForDate(day);
                    }}
                    title={`Criar agendamento em ${day.format("DD/MM/YYYY")}`}
                    className="absolute right-[5px] top-[5px] z-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity hover:scale-110 group-hover:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </button>

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
                          <PopoverContent
                            className="w-72 p-3"
                            align="start"
                            side="right"
                          >
                            <p className="text-sm font-semibold">
                              {ev!.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {ev!.description}
                            </p>
                          </PopoverContent>
                        </Popover>
                      ))}
                    </div>
                  )}

                  {dayAppts.length > 0 && (
                    <div
                      className="grid h-full"
                      style={{
                        gridTemplateColumns: `repeat(${CARDS_PER_ROW}, minmax(0, 1fr))`,
                        gap: `${CARD_GAP}px`,
                        gridAutoRows: `${CARD_HEIGHT}px`,
                        alignContent: "start",
                        paddingTop:
                          DAY_HEADER_OFFSET +
                          ((holiday ? 1 : 0) + (mobilization ? 1 : 0)) *
                            HOLIDAY_LABEL_HEIGHT,
                      }}
                    >
                      {dayAppts.slice(0, MAX_VISIBLE).map((a) => (
                        <MiniCard
                          key={a.id}
                          appt={a}
                          color={getColor(a)}
                          selected={selectedId === a.id}
                          onSelect={handleSelect}
                          draggable
                        />
                      ))}

                      {overflow > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              style={{
                                height: `${PLUS_MORE_HEIGHT}px`,
                                gridColumn: `span ${CARDS_PER_ROW} / span ${CARDS_PER_ROW}`,
                              }}
                              className="w-full shrink-0 rounded bg-muted/50 px-2 text-[11px] font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground"
                            >
                              +{overflow} mais
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-1" align="start">
                            <div className="flex flex-col gap-0.5">
                              {dayAppts.slice(MAX_VISIBLE).map((a) => {
                                const t = dayjs(a.startsAt).format("HH:mm");
                                const name =
                                  a.lead?.name ||
                                  (a.title ?? "").replace(
                                    /^agendamento:\s*/i,
                                    "",
                                  ) ||
                                  "Agendamento";
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => handleSelect(a)}
                                    className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition hover:bg-muted"
                                  >
                                    <span
                                      className="size-2 shrink-0 rounded-full"
                                      style={{ backgroundColor: getColor(a) }}
                                    />
                                    <span className="truncate font-medium">
                                      {name}
                                    </span>
                                    <span className="ml-auto shrink-0 text-muted-foreground">
                                      {t}
                                    </span>
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

          {/* Empty state geral */}
          {!isLoading && appointments.length === 0 && (
            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                <CalendarDays className="size-3.5" />
                Nenhum agendamento neste mês
              </div>
            </div>
          )}
        </div>

        {/* DragOverlay */}
        <DragOverlay>
          {draggingAppt ? (
            <div className="pointer-events-none">
              <MiniCard
                appt={draggingAppt}
                color={getColor(draggingAppt)}
                selected={false}
                onSelect={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {createOpen && (
        <CreateAppointmentModal
          key={`create-${createInitialDate?.toISOString() ?? "now"}`}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          initialDate={createInitialDate}
          initialName={leadName}
          initialPhone={leadPhone}
          initialEmail={leadEmail}
          onSuccess={onAppointmentCreated}
          trackingId={trackingId}
        />
      )}

      <ViewAppointment
        open={viewOpen}
        onOpenChange={(o) => {
          if (!o) closeAppointment();
        }}
        appointmentId={viewId}
      />
    </>
  );
}
