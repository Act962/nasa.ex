"use client";

import {
  addMonths,
  format,
  getDay,
  parse,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, dateFnsLocalizer, SlotInfo } from "react-big-calendar";
import withDragAndDrop, {
  EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "@/features/trackings/components/calendar/data-calendar.css";

import { useQueryAppointmentsByOrg } from "../hooks/use-agenda";
import { useRescheduleAppointment } from "../hooks/use-agenda";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import dayjs from "dayjs";
import { useLocale } from "react-aria";
import "dayjs/locale/pt-br";
import { CreateAppointmentModal } from "@/features/trackings/components/calendar/create-appointment-modal";
import { ViewAppointment } from "@/features/trackings/components/calendar/view-appointment";
import { DayEventsPopup } from "@/features/trackings/components/calendar/day-events-popup";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Localizer ────────────────────────────────────────────────────────────────

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  start: Date;
  end: Date;
  title: string | null | undefined;
  id: string;
  status: string;
}

interface ShowMoreState {
  events: CalendarEvent[];
  date: Date;
  position: { x: number; y: number };
}

// ─── Status colours ───────────────────────────────────────────────────────────

const statusChipColors: Record<string, string> = {
  PENDING:   "bg-yellow-100 border-l-yellow-500 text-yellow-800",
  CONFIRMED: "bg-green-100  border-l-green-500  text-green-800",
  CANCELLED: "bg-red-100    border-l-red-500    text-red-800",
  NO_SHOW:   "bg-red-100    border-l-red-500    text-red-800",
  DONE:      "bg-blue-100   border-l-blue-500   text-blue-800",
};
const defaultChip = "bg-slate-100 border-l-slate-400 text-slate-800";

function EventChip({ event }: { event: CalendarEvent }) {
  const chip = statusChipColors[event.status] ?? defaultChip;
  const clientName = (event.title ?? "").replace(/^agendamento:\s*/i, "");
  const label = `${dayjs(event.start).format("HH:mm")} ${clientName}`.trim();
  return (
    <div
      className={cn(
        "truncate text-[11px] font-semibold leading-tight px-1.5 py-[2px]",
        "border-l-[3px] rounded-[2px]",
        chip,
      )}
      title={label}
    >
      {label}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AllAppointmentsCalendar() {
  const [value, setValue] = useState<Date>(new Date());
  const { appointments } = useQueryAppointmentsByOrg();
  const reschedule = useRescheduleAppointment();

  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date>();
  // viewId: qual agendamento está sendo visualizado
  // viewOpen: controla a animação do Sheet de forma independente
  // Separar os dois evita que o Radix desmonte abruptamente e deixe overlay bloqueando o calendário
  const [viewId, setViewId] = useState<string>("");
  const [viewOpen, setViewOpen] = useState(false);
  const [showMore, setShowMore] = useState<ShowMoreState | null>(null);

  const openAppointment = useCallback((id: string) => {
    setViewId(id);
    setViewOpen(true);
  }, []);

  const closeAppointment = useCallback(() => {
    setViewOpen(false);
    // Aguarda a animação de saída do Sheet (~250ms) antes de limpar o id
    setTimeout(() => setViewId(""), 300);
  }, []);

  const lastClickPos = useRef<{ x: number; y: number }>({ x: 300, y: 300 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      lastClickPos.current = { x: e.clientX, y: e.clientY };
    };
    el.addEventListener("mousedown", handler, true);
    return () => el.removeEventListener("mousedown", handler, true);
  }, []);

  const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
    if (action === "PREV") setValue(subMonths(value, 1));
    else if (action === "NEXT") setValue(addMonths(value, 1));
    else setValue(new Date());
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    setCreateInitialDate(slotInfo.start);
    setCreateOpen(true);
  };

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    openAppointment(event.id);
  }, [openAppointment]);

  const handleShowMore = useCallback((events: CalendarEvent[], date: Date) => {
    setShowMore({ events, date, position: { ...lastClickPos.current } });
  }, []);

  const handleEventDrop = useCallback(
    ({ event, start }: EventInteractionArgs<CalendarEvent>) => {
      const ev = event;
      const newStart = start instanceof Date ? start : new Date(start as string);
      const originalStart = new Date(ev.start);
      const originalEnd   = new Date(ev.end);
      const duration = originalEnd.getTime() - originalStart.getTime();

      const movedStart = new Date(newStart);
      movedStart.setHours(
        originalStart.getHours(),
        originalStart.getMinutes(),
        0,
        0,
      );
      const movedEnd = new Date(movedStart.getTime() + duration);

      toast.promise(
        new Promise<void>((resolve, reject) => {
          reschedule.mutate(
            {
              appointmentId: ev.id,
              startsAt: movedStart.toISOString(),
              endsAt:   movedEnd.toISOString(),
            },
            {
              onSuccess: () => resolve(),
              onError:   (e) => reject(e),
            },
          );
        }),
        {
          loading: "Reagendando...",
          success: "Agendamento reagendado!",
          error: (e: Error) => `Erro: ${e.message}`,
        },
      );
    },
    [reschedule],
  );

  const events: CalendarEvent[] = appointments.map((a) => ({
    start:  new Date(a.startsAt),
    end:    new Date(a.endsAt),
    title:  a.title,
    id:     a.id,
    status: a.status,
  }));

  return (
    <div ref={wrapperRef} className="w-full h-full px-6 py-4 flex flex-col">
      <DnDCalendar
        localizer={localizer}
        date={value}
        events={events}
        culture="pt-BR"
        views={["month"]}
        defaultView="month"
        toolbar
        selectable
        resizable={false}
        draggableAccessor={() => true}
        style={{ flex: 1, minHeight: 0 }}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onShowMore={handleShowMore}
        formats={{
          weekdayFormat: (date, culture, loc) =>
            loc?.format(date, "EEE", culture) ?? "",
        }}
        messages={{
          today:           "Hoje",
          previous:        "Anterior",
          next:            "Próximo",
          month:           "Mês",
          week:            "Semana",
          day:             "Dia",
          agenda:          "Agenda",
          date:            "Data",
          time:            "Hora",
          event:           "Evento",
          noEventsInRange: "Nenhum evento neste período",
          showMore:        (total) => `+ ${total} mais`,
        }}
        components={{
          event: ({ event }) => <EventChip event={event} />,
          toolbar: () => (
            <CalendarToolbar
              date={value}
              onNavigate={handleNavigate}
              onNewAppointment={() => {
                setCreateInitialDate(new Date());
                setCreateOpen(true);
              }}
            />
          ),
        }}
      />

      {/* Popup "Mais X" */}
      {showMore && (
        <DayEventsPopup
          events={showMore.events}
          date={showMore.date}
          position={showMore.position}
          onClose={() => setShowMore(null)}
          onSelectEvent={(id) => {
            setShowMore(null);
            // Pequeno delay para o popup desmontar antes do Sheet abrir,
            // evitando que o Radix detecte o mesmo clique como "fora do Sheet"
            setTimeout(() => openAppointment(id), 50);
          }}
        />
      )}

      {/* Criar agendamento — sem trackingId pré-definido (step 0 selecionará o tracking) */}
      <CreateAppointmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialDate={createInitialDate}
      />

      {/* Detalhar agendamento — sempre montado para o Radix animar o fechamento corretamente */}
      <ViewAppointment
        open={viewOpen}
        onOpenChange={(o) => { if (!o) closeAppointment(); }}
        appointmentId={viewId}
      />
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

interface CalendarToolbarProps {
  date: Date;
  onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
  onNewAppointment: () => void;
}

function CalendarToolbar({ date, onNavigate, onNewAppointment }: CalendarToolbarProps) {
  const { locale } = useLocale();
  return (
    <div className="flex mb-4 gap-x-2 items-center w-full justify-between">
      <div className="flex gap-x-2 items-center">
        <Button onClick={() => onNavigate("PREV")} variant="outline" size="icon-sm">
          <ChevronLeftIcon className="size-4" />
        </Button>
        <div className="flex items-center border border-input rounded-md px-3 py-2 h-8 justify-center capitalize min-w-36">
          <CalendarIcon className="size-4 mr-2 flex-shrink-0" />
          <p className="text-sm font-medium">
            {dayjs(date).locale(locale).format("MMMM YYYY")}
          </p>
        </div>
        <Button onClick={() => onNavigate("NEXT")} variant="outline" size="icon-sm">
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <Button
        onClick={onNewAppointment}
        size="sm"
        className="flex items-center gap-1"
      >
        <PlusIcon className="size-4" />
        Novo Agendamento
      </Button>
    </div>
  );
}
