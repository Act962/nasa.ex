"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClockIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Data e hora do primeiro disparo do Gatilho do lead (spec 0038, RF-3):
// calendário + horário em meia hora, no fuso do navegador.

const HALF_HOUR_TIMES = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  return `${hours}:${index % 2 === 0 ? "00" : "30"}`;
});
const DEFAULT_TIME = "09:00";

function withTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function timeOf(date: Date | null): string {
  if (!date) return DEFAULT_TIME;
  return `${String(date.getHours()).padStart(2, "0")}:${date.getMinutes() < 30 ? "00" : "30"}`;
}

interface TriggerDateTimePickerProps {
  value: Date | null;
  onChange: (value: Date) => void;
  className?: string;
  /** Fundo dos botões — muda com o card ligado (verde) ou desligado (cinza). */
  surfaceClassName?: string;
}

export function TriggerDateTimePicker({ value, onChange, className, surfaceClassName }: TriggerDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const time = timeOf(value);

  return (
    <div className={cn("flex items-center", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors", surfaceClassName)}
          >
            <CalendarClockIcon className="size-3.5 opacity-80" />
            {value ? format(value, "dd/MM '·' HH:mm", { locale: ptBR }) : "Data e hora"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={value ?? undefined}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            onSelect={(date) => {
              if (!date) return;
              onChange(withTime(date, time));
            }}
          />
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <span className="text-xs text-muted-foreground">Horário</span>
            <Select value={time} onValueChange={(nextTime) => onChange(withTime(value ?? new Date(), nextTime))}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {HALF_HOUR_TIMES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>

    </div>
  );
}
