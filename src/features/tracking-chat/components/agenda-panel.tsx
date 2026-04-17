"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  PlusIcon,
  XIcon,
  ClockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useQueryAgendasByTracking,
  useAdminCreateAppointment,
  useQueryAppointmentsByOrg,
} from "@/features/agenda/hooks/use-agenda";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-yellow-400 text-yellow-900",
  PENDING: "bg-blue-400 text-blue-900",
  CANCELLED: "bg-red-400 text-red-900",
  DONE: "bg-green-400 text-green-900",
  NO_SHOW: "bg-gray-400 text-gray-900",
};

// ─── Mini Calendar Grid ───────────────────────────────────────────────────────

interface MiniCalendarProps {
  currentMonth: dayjs.Dayjs;
  selectedDate: string | null;
  appointmentDates: Set<string>;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function MiniCalendar({
  currentMonth,
  selectedDate,
  appointmentDates,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: MiniCalendarProps) {
  const startOfMonth = currentMonth.startOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const startDay = startOfMonth.day(); // 0 = Sunday
  const today = dayjs().format("YYYY-MM-DD");

  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-1">
      {/* Month nav */}
      <div className="flex items-center justify-between px-1 mb-1">
        <button
          onClick={onPrevMonth}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronLeftIcon className="size-3.5" />
        </button>
        <span className="text-xs font-semibold capitalize">
          {currentMonth.format("MMMM YYYY")}
        </span>
        <button
          onClick={onNextMonth}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronRightIcon className="size-3.5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="text-[10px] text-muted-foreground text-center font-medium py-0.5"
          >
            {d}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const dateStr = currentMonth.date(day).format("YYYY-MM-DD");
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const hasAppt = appointmentDates.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                "relative text-xs h-7 w-full rounded flex items-center justify-center transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold"
                  : isToday
                    ? "border border-primary text-primary font-semibold"
                    : "hover:bg-muted",
              )}
            >
              {day}
              {hasAppt && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── All Appointments View ────────────────────────────────────────────────────

function AllAppointmentsView({
  trackingId,
  onNewAppointment,
}: {
  trackingId: string;
  onNewAppointment: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf("month"));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { appointments, isLoading } = useQueryAppointmentsByOrg();

  const filteredByTracking = useMemo(
    () => appointments.filter((a: any) => a.trackingId === trackingId),
    [appointments, trackingId],
  );

  const appointmentDates = useMemo(
    () => new Set(filteredByTracking.map((a: any) => dayjs(a.startsAt).format("YYYY-MM-DD"))),
    [filteredByTracking],
  );

  const dayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return filteredByTracking
      .filter((a: any) => dayjs(a.startsAt).format("YYYY-MM-DD") === selectedDate)
      .sort((a: any, b: any) => dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf());
  }, [filteredByTracking, selectedDate]);

  return (
    <div className="flex flex-col gap-3 px-3 pb-3">
      {/* Header toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="size-3.5" />
          <span>Todos os agendamentos</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={onNewAppointment}>
          <PlusIcon className="size-3" />
          Novo compromisso
        </Button>
      </div>

      {/* Mini calendar */}
      <MiniCalendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        appointmentDates={appointmentDates as Set<string>}
        onSelectDate={(d) => setSelectedDate(selectedDate === d ? null : d)}
        onPrevMonth={() => setCurrentMonth((m) => m.subtract(1, "month"))}
        onNextMonth={() => setCurrentMonth((m) => m.add(1, "month"))}
      />

      {/* Day appointments */}
      {selectedDate && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {dayjs(selectedDate).format("dddd, D [de] MMMM")}
          </p>
          {isLoading && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Carregando...
            </p>
          )}
          {!isLoading && dayAppointments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Sem agendamentos neste dia
            </p>
          )}
          {dayAppointments.map((a: any) => (
            <div
              key={a.id}
              className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-card"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-medium truncate">
                  {a.title ?? "Agendamento"}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  {dayjs(a.startsAt).format("HH:mm")} —{" "}
                  {dayjs(a.endsAt).format("HH:mm")}
                </span>
              </div>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                  STATUS_COLORS[a.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Appointment View ─────────────────────────────────────────────────────

function NewAppointmentView({
  trackingId,
  leadName,
  leadPhone,
  onBack,
  onCreated,
}: {
  trackingId: string;
  leadName?: string;
  leadPhone?: string;
  onBack: () => void;
  onCreated: (agendaSlug: string, orgSlug: string) => void;
}) {
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf("month"));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: agendasData, isLoading: loadingAgendas } =
    useQueryAgendasByTracking(trackingId);
  const agendas = agendasData?.agendas ?? [];

  const selectedAgenda = agendas.find((a) => a.id === selectedAgendaId);

  // Fetch time slots when agenda + date are selected
  const { data: timeSlotsData, isLoading: loadingSlots } = useQuery({
    ...orpc.agenda.public.getTimeSlots.queryOptions({
      input: {
        date: selectedDate ?? "",
        agendaSlug: selectedAgenda?.slug ?? "",
        orgSlug: (selectedAgenda as any)?.organization?.slug ?? "",
      },
    }),
    enabled: !!selectedAgendaId && !!selectedDate && !!selectedAgenda,
  });
  const timeSlots = timeSlotsData?.timeSlots ?? [];

  // Appointments for calendar dots
  const { appointments } = useQueryAppointmentsByOrg();
  const appointmentDates = useMemo(
    () =>
      new Set(
        appointments
          .filter((a: any) => a.trackingId === trackingId)
          .map((a: any) => dayjs(a.startsAt).format("YYYY-MM-DD")),
      ),
    [appointments, trackingId],
  );

  const createAppointment = useAdminCreateAppointment();

  async function handleCreate() {
    if (!selectedAgendaId) return toast.error("Selecione uma agenda");
    if (!selectedDate) return toast.error("Selecione uma data");
    if (!selectedTime) return toast.error("Selecione um horário");
    if (!leadName || !leadPhone) return toast.error("Dados do lead incompletos");

    createAppointment.mutate(
      {
        agendaId: selectedAgendaId,
        date: selectedDate,
        time: selectedTime,
        name: leadName,
        phone: leadPhone,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onSuccess: () => {
          onCreated(
            selectedAgenda?.slug ?? "",
            (selectedAgenda as any)?.organization?.slug ?? "",
          );
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 pb-3 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        Quando
      </p>

      {/* Agenda selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">
          Agenda <span className="text-destructive">*</span>
        </label>
        {loadingAgendas ? (
          <p className="text-xs text-muted-foreground">Carregando agendas...</p>
        ) : (
          <Select value={selectedAgendaId} onValueChange={(v) => { setSelectedAgendaId(v); setSelectedDate(null); setSelectedTime(null); }}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione uma agenda..." />
            </SelectTrigger>
            <SelectContent>
              {agendas.length === 0 && (
                <SelectItem value="_none" disabled>
                  Nenhuma agenda disponível
                </SelectItem>
              )}
              {agendas.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Calendar + time slots side by side */}
      <div className="flex gap-3">
        {/* Left: calendar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Data</span>
            {selectedDate && (
              <span className="text-xs text-muted-foreground ml-auto">
                {dayjs(selectedDate).format("DD/MM/YYYY")}
              </span>
            )}
          </div>
          <MiniCalendar
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            appointmentDates={appointmentDates as Set<string>}
            onSelectDate={(d) => { setSelectedDate(d); setSelectedTime(null); }}
            onPrevMonth={() => setCurrentMonth((m) => m.subtract(1, "month"))}
            onNextMonth={() => setCurrentMonth((m) => m.add(1, "month"))}
          />
        </div>

        {/* Right: time slots */}
        <div className="w-[90px] shrink-0 flex flex-col gap-1 mt-5">
          {!selectedAgendaId && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <CalendarIcon className="size-6 text-muted-foreground/50" />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Selecione uma agenda para ver os horários
              </p>
            </div>
          )}
          {selectedAgendaId && !selectedDate && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Selecione uma data
            </p>
          )}
          {selectedAgendaId && selectedDate && (
            <>
              {loadingSlots ? (
                <p className="text-[10px] text-muted-foreground text-center">
                  Carregando...
                </p>
              ) : timeSlots.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center">
                  Sem horários disponíveis
                </p>
              ) : (
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[200px]">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() =>
                        setSelectedTime(
                          selectedTime === slot.startTime ? null : slot.startTime,
                        )
                      }
                      className={cn(
                        "text-[11px] rounded px-2 py-1.5 border text-center transition-colors font-medium",
                        selectedTime === slot.startTime
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted border-border",
                      )}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      {selectedDate && selectedTime && (
        <div className="rounded-lg bg-muted/50 border px-3 py-2 text-xs flex flex-col gap-0.5">
          <span className="font-medium">{leadName}</span>
          <span className="text-muted-foreground">
            {dayjs(selectedDate).format("dddd, D [de] MMMM")} às {selectedTime}
          </span>
        </div>
      )}

      {/* CTA */}
      <Button
        className="w-full gap-2"
        size="sm"
        onClick={handleCreate}
        disabled={
          createAppointment.isPending ||
          !selectedAgendaId ||
          !selectedDate ||
          !selectedTime
        }
      >
        {createAppointment.isPending ? "Agendando..." : "Agendar para Lead e enviar link"}
      </Button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface AgendaPanelProps {
  onClose: () => void;
  onInsertLink: (text: string) => void;
  trackingId: string;
  leadName?: string;
  leadPhone?: string;
}

type View = "calendar" | "new";

export function AgendaPanel({
  onClose,
  onInsertLink,
  trackingId,
  leadName,
  leadPhone,
}: AgendaPanelProps) {
  const [view, setView] = useState<View>("calendar");

  function handleCreated(agendaSlug: string, orgSlug: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
    const link = `${baseUrl}/agenda/${orgSlug}/${agendaSlug}`;
    const text = `Agendamento confirmado! Acesse sua agenda: ${link}`;
    onInsertLink(text);
    toast.success("Agendamento criado e link inserido na mensagem!");
    setView("calendar");
  }

  return (
    <div
      className="absolute bottom-full left-0 mb-2 bg-popover border rounded-xl shadow-lg z-50 flex flex-col overflow-hidden"
      style={{ width: 380, height: 520 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          {view === "new" && (
            <button
              onClick={() => setView("calendar")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
          )}
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            {view === "calendar" ? "Todos os agendamentos" : "Novo compromisso"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col overflow-y-auto flex-1 pt-3">
        {view === "calendar" ? (
          <AllAppointmentsView
            trackingId={trackingId}
            onNewAppointment={() => setView("new")}
          />
        ) : (
          <NewAppointmentView
            trackingId={trackingId}
            leadName={leadName}
            leadPhone={leadPhone}
            onBack={() => setView("calendar")}
            onCreated={handleCreated}
          />
        )}
      </div>
    </div>
  );
}
