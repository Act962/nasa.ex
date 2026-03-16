import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSuspenseAvailabilities } from "../hooks/use-agenda";
import { DayOfWeek } from "@/generated/prisma/enums";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AvailabilityProps {
  agendaId: string;
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

export function Availability({ agendaId }: AvailabilityProps) {
  const { data } = useSuspenseAvailabilities(agendaId);

  const times = generateTimes(15);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disponibilidade</CardTitle>
        <CardDescription>
          Gerencie as disponibilidades da agenda
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => e.preventDefault()}>
        <CardContent className="space-y-6">
          {data.availabilities.map((availability) => (
            <div key={availability.id} className="flex items-baseline gap-x-3">
              <div className="flex items-center gap-x-3 w-1/2">
                <Switch checked={availability.isActive} />
                <span className="font-medium text-sm">
                  {DAYS[availability.dayOfWeek]}
                </span>
              </div>
              <div>
                {availability.timeSlots.map((timeSlot, index) => {
                  return (
                    <div
                      key={timeSlot.id}
                      className="flex items-center gap-x-2 mb-1"
                    >
                      <Select defaultValue={timeSlot.startTime}>
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {times.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      -
                      <Select defaultValue={timeSlot.endTime}>
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {times.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {index === 0 && (
                        <Button size="icon-sm" variant="ghost">
                          <PlusIcon />
                        </Button>
                      )}
                      {index > 0 && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="hover:bg-destructive! hover:text-white!"
                        >
                          <TrashIcon />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </form>
    </Card>
  );
}
