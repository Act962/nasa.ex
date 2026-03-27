import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCreateTimeSlot,
  useDeleteTimeSlot,
  useSuspenseAvailabilities,
  useSuspenseDateOverrides,
  useSuspenseTimeSlots,
  useToggleActiveAvailability,
  useToggleDateOverride,
  useUpdateTimeSlot,
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
import { BanIcon, PlusIcon, TrashIcon } from "lucide-react";
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
      const hour = String(h).padStart(2, "0");
      const minute = String(m).padStart(2, "0");

      times.push(`${hour}:${minute}`);
    }
  }

  return times;
}


// ─────────────────────────────────────────────
// CALENDÁRIO DE BLOQUEIOS ESPECÍFICOS
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
            Clique em uma data para bloqueá-la individualmente (férias, feriados, etc.)
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

export function Availability({
  agendaId,
  availabilities,
  slotDuration,
}: AvailabilityProps) {
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
        <CardTitle>Disponibilidade</CardTitle>
        <CardDescription>
          Gerencie as disponibilidades da agenda
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => e.preventDefault()}>
        <CardContent className="space-y-6">
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
        </CardContent>
      </form>
    </Card>
  );
}

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

        // StartTime options must be >= last endTime
        // We also ensure the current value is always included
        const startTimeOptions = Array.from(
          new Set([
            timeSlot.startTime,
            ...(prevSlot ? times.filter((t) => t >= prevSlot.endTime) : times),
          ]),
        ).sort();

        // EndTime options must be > current startTime
        // We also ensure the current value is always included
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
