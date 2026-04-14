"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCreateDateAvailabilitySlot,
  useCreateTimeSlot,
  useDeleteDateAvailability,
  useDeleteDateAvailabilitySlot,
  useDeleteTimeSlot,
  useQueryDateAvailabilities,
  useSuspenseDateOverrides,
  useSuspenseTimeSlots,
  useToggleActiveAvailability,
  useToggleDateOverride,
  useUpdateDateAvailabilitySlot,
  useUpdateTimeSlot,
  useUpsertDateAvailability,
} from "../hooks/use-agenda";
import { DayOfWeek } from "@/generated/prisma/enums";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BanIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { cn } from "@/lib/utils";

interface Availability {
  id: string;
  agendaId: string;
  isActive: boolean;
  dayOfWeek: DayOfWeek;
}

interface AvailabilityProps {
  agendaId: string;
  availabilities: Availability[];
  slotDuration: number;
}

const DAYS = {
  [DayOfWeek.SUNDAY]: "Domingo",
  [DayOfWeek.MONDAY]: "Segunda-feira",
  [DayOfWeek.TUESDAY]: "Terça-feira",
  [DayOfWeek.WEDNESDAY]: "Quarta-feira",
  [DayOfWeek.THURSDAY]: "Quinta-feira",
  [DayOfWeek.FRIDAY]: "Sexta-feira",
  [DayOfWeek.SATURDAY]: "Sábado",
};

export function generateTimes(interval = 15) {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += interval) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}

// ─────────────────────────────────────────────
// CALENDÁRIO DE BLOQUEIOS ESPECÍFICOS (Semanal mode)
// ─────────────────────────────────────────────
function DateOverridesCalendar({ agendaId }: { agendaId: string }) {
  const { data } = useSuspenseDateOverrides(agendaId);
  const toggleDateOverride = useToggleDateOverride();
  const [currentMonth, setCurrentMonth] = useState(() =>
    dayjs().startOf("month"),
  );

  const blockedDatesSet = new Set(
    data.dateOverrides.filter((d) => d.isBlocked).map((d) => d.date),
  );

  const handleToggle = (date: string) => {
    const isCurrentlyBlocked = blockedDatesSet.has(date);
    toggleDateOverride.mutate({
      agendaId,
      date,
      isBlocked: !isCurrentlyBlocked,
    });
  };

  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = currentMonth.day();
  const today = dayjs().format("YYYY-MM-DD");

  return (
    <div className="mt-6 border-t pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Bloqueios de datas específicas</p>
          <p className="text-xs text-muted-foreground">
            Clique em uma data para bloqueá-la individualmente (férias,
            feriados, etc.)
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-base"
            onClick={() => setCurrentMonth(currentMonth.subtract(1, "month"))}
          >
            ‹
          </Button>
          <span className="text-sm font-medium capitalize w-36 text-center">
            {currentMonth.locale("pt-br").format("MMMM YYYY")}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-base"
            onClick={() => setCurrentMonth(currentMonth.add(1, "month"))}
          >
            ›
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = currentMonth.date(i + 1).format("YYYY-MM-DD");
          const isPast = date < today;
          const isBlocked = blockedDatesSet.has(date);

          return (
            <button
              key={date}
              disabled={isPast || toggleDateOverride.isPending}
              onClick={() => handleToggle(date)}
              title={isBlocked ? `Desbloquear ${date}` : `Bloquear ${date}`}
              className={cn(
                "relative h-9 w-full rounded-md flex items-center justify-center font-medium transition-colors",
                isPast && "opacity-30 cursor-not-allowed text-muted-foreground",
                isBlocked &&
                  "bg-destructive/15 text-destructive hover:bg-destructive/25 cursor-pointer",
                !isBlocked &&
                  !isPast &&
                  "hover:bg-accent cursor-pointer text-foreground",
              )}
            >
              {i + 1}
              {isBlocked && (
                <BanIcon className="absolute top-0.5 right-0.5 size-2.5 text-destructive" />
              )}
            </button>
          );
        })}
      </div>

      {blockedDatesSet.size > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {blockedDatesSet.size} data(s) bloqueada(s)
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DIA MODE — Calendar + date-specific time ranges
// ─────────────────────────────────────────────
function DiaMode({
  agendaId,
  slotDuration,
}: {
  agendaId: string;
  slotDuration: number;
}) {
  const { data, isLoading } = useQueryDateAvailabilities(agendaId);
  const upsert = useUpsertDateAvailability();
  const deleteDateAvail = useDeleteDateAvailability();

  const [currentMonth, setCurrentMonth] = useState(() =>
    dayjs().startOf("month"),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dateAvailabilities = data?.dateAvailabilities ?? [];
  const configuredDatesSet = new Set(dateAvailabilities.map((d) => d.date));

  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = currentMonth.day();
  const today = dayjs().format("YYYY-MM-DD");

  const handleClickDate = (date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
    // If not yet configured, auto-create
    if (!configuredDatesSet.has(date)) {
      upsert.mutate({ agendaId, date });
    }
  };

  const selectedAvail = dateAvailabilities.find((d) => d.date === selectedDate);

  // Generate preview slots for the selected date
  const previewSlots: string[] = [];
  if (selectedAvail && selectedAvail.timeSlots.length > 0) {
    for (const range of selectedAvail.timeSlots) {
      let cur = dayjs(`2000-01-01T${range.startTime}`);
      const end = dayjs(`2000-01-01T${range.endTime}`);
      while (cur.isBefore(end) || cur.isSame(end)) {
        previewSlots.push(cur.format("HH:mm"));
        cur = cur.add(slotDuration, "minute");
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* ── Mini Calendar ── */}
      <div className="flex-shrink-0 w-full md:w-[280px]">
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setCurrentMonth(currentMonth.subtract(1, "month"))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-sm font-semibold capitalize">
              {currentMonth.locale("pt-br").format("MMMM YYYY")}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setCurrentMonth(currentMonth.add(1, "month"))}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div
                key={d}
                className="font-medium text-muted-foreground py-1 text-[11px]"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const date = currentMonth.date(i + 1).format("YYYY-MM-DD");
              const isPast = date < today;
              const isConfigured = configuredDatesSet.has(date);
              const isSelected = selectedDate === date;

              return (
                <button
                  key={date}
                  disabled={isPast}
                  onClick={() => handleClickDate(date)}
                  className={cn(
                    "relative h-8 w-full rounded-md flex flex-col items-center justify-center text-xs font-medium transition-colors",
                    isPast &&
                      "opacity-30 cursor-not-allowed text-muted-foreground",
                    isSelected && "bg-primary text-primary-foreground",
                    !isSelected && !isPast && "hover:bg-accent cursor-pointer",
                  )}
                >
                  {i + 1}
                  {isConfigured && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                  {isConfigured && isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground" />
                  )}
                </button>
              );
            })}
          </div>

          {configuredDatesSet.size > 0 && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              {configuredDatesSet.size} data(s) configurada(s)
            </p>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Clique em uma data para configurar horários específicos. Datas com{" "}
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle mx-0.5" />{" "}
          possuem configuração.
        </p>
      </div>

      {/* ── Right panel: time ranges + preview ── */}
      <div className="flex-1 min-w-0">
        {!selectedDate ? (
          <div className="flex flex-col items-center justify-center h-48 border rounded-xl text-center gap-2">
            <CalendarIcon className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Selecione uma data no calendário
            </p>
            <p className="text-xs text-muted-foreground/60">
              Clique em qualquer data para configurar os horários disponíveis
            </p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="size-4 text-muted-foreground" />
                <span className="font-semibold text-sm">
                  {dayjs(selectedDate)
                    .locale("pt-br")
                    .format("dddd, DD/MM/YYYY")}
                </span>
              </div>
              {selectedAvail && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    deleteDateAvail.mutate({
                      dateAvailabilityId: selectedAvail.id,
                    });
                    setSelectedDate(null);
                  }}
                  disabled={deleteDateAvail.isPending}
                >
                  <TrashIcon className="size-3 mr-1" />
                  Remover data
                </Button>
              )}
            </div>

            <div className="flex flex-col md:flex-row">
              {/* Time range pickers */}
              <div className="flex-1 p-4 border-r">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                  <ClockIcon className="size-3.5" /> Intervalos de horário
                </p>

                {!selectedAvail || selectedAvail.timeSlots.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-3">
                    <p className="text-sm text-muted-foreground">
                      Nenhum horário configurado
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        if (selectedAvail) {
                          // already exists, just add slot
                        } else {
                          upsert.mutate({ agendaId, date: selectedDate });
                        }
                      }}
                      disabled={upsert.isPending}
                    >
                      <PlusIcon className="size-3.5" />
                      Adicionar horário
                    </Button>
                  </div>
                ) : (
                  <DateAvailabilitySlots
                    dateAvailabilityId={selectedAvail.id}
                    timeSlots={selectedAvail.timeSlots}
                    slotDuration={slotDuration}
                  />
                )}
              </div>

              {/* Preview of generated slots */}
              <div className="w-full md:w-[180px] p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                  <CheckIcon className="size-3.5" /> Horários gerados
                </p>
                {previewSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum slot gerado
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {previewSlots.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DateAvailabilitySlots({
  dateAvailabilityId,
  timeSlots,
  slotDuration,
}: {
  dateAvailabilityId: string;
  timeSlots: {
    id: string;
    startTime: string;
    endTime: string;
    order: number;
  }[];
  slotDuration: number;
}) {
  const times = generateTimes(slotDuration);
  const createSlot = useCreateDateAvailabilitySlot();
  const updateSlot = useUpdateDateAvailabilitySlot();
  const deleteSlot = useDeleteDateAvailabilitySlot();

  return (
    <div className="space-y-2">
      {timeSlots.map((slot, index) => {
        const prevSlot = timeSlots[index - 1];
        const startOptions = Array.from(
          new Set([
            slot.startTime,
            ...(prevSlot ? times.filter((t) => t >= prevSlot.endTime) : times),
          ]),
        ).sort();

        const endOptions = Array.from(
          new Set([slot.endTime, ...times.filter((t) => t > slot.startTime)]),
        ).sort();

        return (
          <div key={slot.id} className="flex items-center gap-2">
            <Select
              value={slot.startTime}
              onValueChange={(val) =>
                updateSlot.mutate({ slotId: slot.id, startTime: val })
              }
              disabled={updateSlot.isPending}
            >
              <SelectTrigger className="w-[90px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {startOptions.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground text-xs">–</span>

            <Select
              value={slot.endTime}
              onValueChange={(val) =>
                updateSlot.mutate({ slotId: slot.id, endTime: val })
              }
              disabled={updateSlot.isPending}
            >
              <SelectTrigger className="w-[90px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {endOptions.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => createSlot.mutate({ dateAvailabilityId })}
                disabled={createSlot.isPending}
              >
                <PlusIcon className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => deleteSlot.mutate({ slotId: slot.id })}
                disabled={deleteSlot.isPending}
              >
                <TrashIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        );
      })}

      {timeSlots.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs mt-1"
          onClick={() => createSlot.mutate({ dateAvailabilityId })}
          disabled={createSlot.isPending}
        >
          <PlusIcon className="size-3.5" />
          Adicionar intervalo
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN Availability component
// ─────────────────────────────────────────────
export function Availability({
  agendaId,
  availabilities,
  slotDuration,
}: AvailabilityProps) {
  const [mode, setMode] = useState<"semanal" | "dia">("semanal");

  const sortedAvailabilities = [...availabilities].sort((a, b) => {
    const daysOrder = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return daysOrder.indexOf(a.dayOfWeek) - daysOrder.indexOf(b.dayOfWeek);
  });

  return (
    <Card className="bg-transparent">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
          <div>
            <CardTitle>Disponibilidade</CardTitle>
            <CardDescription>
              Gerencie as disponibilidades da agenda
            </CardDescription>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1 gap-1 shrink-0">
            <button
              onClick={() => setMode("semanal")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                mode === "semanal"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <CalendarIcon className="size-3.5" />
              Semanal
            </button>
            <button
              onClick={() => setMode("dia")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                mode === "dia"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <CalendarDaysIcon className="size-3.5" />
              Dia
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 overflow-x-auto">
        {mode === "semanal" ? (
          <>
            {sortedAvailabilities.map((availability) => (
              <AvailabilityItem
                key={availability.id}
                availability={availability}
                slotDuration={slotDuration}
              />
            ))}
            <Suspense
              fallback={
                <div className="border-t pt-6 text-xs text-muted-foreground">
                  Carregando bloqueios...
                </div>
              }
            >
              <DateOverridesCalendar agendaId={agendaId} />
            </Suspense>
          </>
        ) : (
          <DiaMode agendaId={agendaId} slotDuration={slotDuration} />
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// SEMANAL mode — per weekday row
// ─────────────────────────────────────────────
function AvailabilityItem({
  availability,
  slotDuration,
}: {
  availability: Availability;
  slotDuration: number;
}) {
  const [isActive, setIsActive] = useState(availability.isActive);
  const toggleActiveAvailability = useToggleActiveAvailability();

  const handleToggleActiveAvailability = () => {
    toggleActiveAvailability.mutate({
      availabilityId: availability.id,
      isActive: !isActive,
    });
    setIsActive(!isActive);
  };

  return (
    <div className="flex items-start gap-x-3 py-4 border-b last:border-0 border-border/50">
      <div className="flex items-center gap-x-3 w-[180px] shrink-0 pt-1">
        <Switch
          checked={isActive}
          onCheckedChange={handleToggleActiveAvailability}
        />
        <span className="font-medium text-sm">
          {DAYS[availability.dayOfWeek]}
        </span>
      </div>
      <div className="flex-1">
        <Suspense
          fallback={
            <div className="h-9 flex items-center text-xs text-muted-foreground">
              Carregando horários...
            </div>
          }
        >
          {isActive ? (
            <TimeSlots
              availabilityId={availability.id}
              slotDuration={slotDuration}
            />
          ) : (
            <div className="h-9 flex items-center text-sm text-muted-foreground italic">
              Indisponível
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}

interface TimeSlotsProps {
  availabilityId: string;
  slotDuration: number;
}

function TimeSlots({ availabilityId, slotDuration }: TimeSlotsProps) {
  const times = generateTimes(slotDuration);
  const { data } = useSuspenseTimeSlots(availabilityId);
  const createTimeSlot = useCreateTimeSlot();
  const updateTimeSlot = useUpdateTimeSlot();
  const deleteTimeSlot = useDeleteTimeSlot();

  const handleAdd = () => {
    createTimeSlot.mutate({ availabilityId });
  };

  const handleUpdate = (
    timeSlotId: string,
    startTime?: string,
    endTime?: string,
  ) => {
    updateTimeSlot.mutate({ timeSlotId, startTime, endTime });
  };

  const handleDelete = (timeSlotId: string) => {
    deleteTimeSlot.mutate({ timeSlotId });
  };

  if (data.timeslots.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-x-2"
        onClick={handleAdd}
        disabled={createTimeSlot.isPending}
      >
        <PlusIcon className="w-4 h-4" />
        Adicionar horário
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {data.timeslots.map((timeSlot, index) => {
        const prevSlot = data.timeslots[index - 1];

        const startTimeOptions = Array.from(
          new Set([
            timeSlot.startTime,
            ...(prevSlot ? times.filter((t) => t >= prevSlot.endTime) : times),
          ]),
        ).sort();

        const endTimeOptions = Array.from(
          new Set([
            timeSlot.endTime,
            ...times.filter((t) => t > timeSlot.startTime),
          ]),
        ).sort();

        return (
          <div key={timeSlot.id} className="flex items-center gap-x-2">
            <div className="flex items-center gap-x-2">
              <Select
                value={timeSlot.startTime}
                onValueChange={(val) => handleUpdate(timeSlot.id, val)}
                disabled={updateTimeSlot.isPending}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {startTimeOptions.map((time) => (
                    <SelectItem key={time} value={time} className="text-xs">
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">-</span>
              <Select
                value={timeSlot.endTime}
                onValueChange={(val) =>
                  handleUpdate(timeSlot.id, undefined, val)
                }
                disabled={updateTimeSlot.isPending}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {endTimeOptions.map((time) => (
                    <SelectItem key={time} value={time} className="text-xs">
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-x-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleAdd}
                disabled={createTimeSlot.isPending}
              >
                <PlusIcon className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(timeSlot.id)}
                disabled={deleteTimeSlot.isPending}
              >
                <TrashIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
