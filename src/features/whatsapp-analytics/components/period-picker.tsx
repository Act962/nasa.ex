"use client";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { pt } from "react-day-picker/locale";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PeriodRange {
  from: Date;
  to: Date;
}

interface PeriodPickerProps {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
}

const PRESETS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

/**
 * Versão simplificada do `DateRangeTimePicker` (sem granularidade de hora)
 * — a Graph API de analytics já entrega os dados com detalhamento diário.
 */
export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const applyPreset = (days: number) => {
    const now = dayjs().endOf("day").toDate();
    const from = dayjs().subtract(days, "day").startOf("day").toDate();
    onChange({ from, to: now });
  };

  const label = `${format(value.from, "dd/MM/yy", { locale: ptBR })} – ${format(value.to, "dd/MM/yy", { locale: ptBR })}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs justify-start font-normal")}
        >
          <CalendarIcon className="mr-1.5 size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          locale={pt}
          mode="range"
          timeZone="America/Sao_Paulo"
          defaultMonth={value.from}
          selected={{ from: value.from, to: value.to }}
          onSelect={(range) => {
            if (range?.from && range?.to) {
              onChange({
                from: dayjs(range.from).startOf("day").toDate(),
                to: dayjs(range.to).endOf("day").toDate(),
              });
            }
          }}
          numberOfMonths={2}
        />
        <div className="flex items-center justify-end gap-1.5 border-t p-3">
          {PRESETS.map((preset) => (
            <Button
              key={preset.days}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
