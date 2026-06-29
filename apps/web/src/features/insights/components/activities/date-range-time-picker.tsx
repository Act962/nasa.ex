"use client";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { pt } from "react-day-picker/locale";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  from?: Date;
  to?: Date;
  onChange: (range: { from?: Date; to?: Date }) => void;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function timeFromDate(d?: Date) {
  if (!d) return "00:00";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function applyTime(date: Date | undefined, hhmm: string): Date | undefined {
  if (!date) return undefined;
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const out = new Date(date);
  out.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
  return out;
}

export function DateRangeTimePicker({ from, to, onChange }: Props) {
  const fromTime = timeFromDate(from);
  const toTime = timeFromDate(to);

  const handleRangeSelect = (range?: { from?: Date; to?: Date }) => {
    onChange({
      from: applyTime(
        range?.from ? dayjs(range.from).startOf("day").toDate() : undefined,
        fromTime,
      ),
      to: applyTime(
        range?.to ? dayjs(range.to).startOf("day").toDate() : undefined,
        toTime,
      ),
    });
  };

  const handleFromTimeChange = (hhmm: string) => {
    onChange({ from: applyTime(from, hhmm), to });
  };

  const handleToTimeChange = (hhmm: string) => {
    onChange({ from, to: applyTime(to, hhmm) });
  };

  const applyPreset = (days: number) => {
    const now = new Date();
    const startBase = new Date(now);
    startBase.setDate(startBase.getDate() - days);
    onChange({
      from: applyTime(dayjs(startBase).startOf("day").toDate(), "00:00"),
      to: applyTime(dayjs(now).startOf("day").toDate(), "23:59"),
    });
  };

  const label = from
    ? to
      ? `${format(from, "dd/MM/yy HH:mm", { locale: ptBR })} – ${format(to, "dd/MM/yy HH:mm", { locale: ptBR })}`
      : format(from, "dd/MM/yy HH:mm", { locale: ptBR })
    : "Selecione o período";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 text-xs justify-start font-normal",
            !from && "text-muted-foreground",
          )}
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
          defaultMonth={from}
          selected={{ from, to }}
          onSelect={handleRangeSelect}
          numberOfMonths={2}
        />

        <div className="grid grid-cols-2 gap-2 border-t p-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Início
            </Label>
            <Input
              type="time"
              value={fromTime}
              onChange={(e) => handleFromTimeChange(e.target.value)}
              className="h-8 text-xs"
              disabled={!from}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Fim
            </Label>
            <Input
              type="time"
              value={toTime}
              onChange={(e) => handleToTimeChange(e.target.value)}
              className="h-8 text-xs"
              disabled={!to}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange({ from: undefined, to: undefined })}
          >
            Limpar
          </Button>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyPreset(7)}
            >
              7 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyPreset(30)}
            >
              30 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyPreset(90)}
            >
              90 dias
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
