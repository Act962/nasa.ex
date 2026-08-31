"use client";

/**
 * PaymentPeriodPicker — seletor de período padrão do NASA Payment.
 *
 * Baseado no `DateRangeTimePicker` do Insights (o "modelo do Orbita") — calendar
 * range de 2 meses + hora de início/fim + presets. Aqui os presets são
 * financeiros: "Este mês", "Mês passado", "Últimos 30 dias", "Este ano".
 *
 * Sempre entrega um `{from, to}` — o caller responsável por converter em
 * `dateFrom`/`dateTo` ISO ao chamar o backend.
 */

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
import { useIsMobile } from "@/hooks/use-mobile";

export type PeriodRange = { from?: Date; to?: Date };

interface Props {
  from?: Date;
  to?: Date;
  onChange: (range: PeriodRange) => void;
  /** Ocultar seletor de hora (só data). Default: false. */
  hideTime?: boolean;
  /** Classes extras no botão que abre o calendário. */
  triggerClassName?: string;
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

export function PaymentPeriodPicker({
  from,
  to,
  onChange,
  hideTime = false,
  triggerClassName,
}: Props) {
  // Dois meses lado a lado estouram a largura no celular.
  const isMobile = useIsMobile();
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
        toTime === "00:00" ? "23:59" : toTime,
      ),
    });
  };

  function handleFromTimeChange(hhmm: string) {
    onChange({ from: applyTime(from, hhmm), to });
  }

  function handleToTimeChange(hhmm: string) {
    onChange({ from, to: applyTime(to, hhmm) });
  }

  function applyThisMonth() {
    const now = dayjs();
    onChange({
      from: applyTime(now.startOf("month").toDate(), "00:00"),
      to: applyTime(now.endOf("month").toDate(), "23:59"),
    });
  }

  function applyLastMonth() {
    const last = dayjs().subtract(1, "month");
    onChange({
      from: applyTime(last.startOf("month").toDate(), "00:00"),
      to: applyTime(last.endOf("month").toDate(), "23:59"),
    });
  }

  function applyLastDays(days: number) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    onChange({
      from: applyTime(dayjs(start).startOf("day").toDate(), "00:00"),
      to: applyTime(dayjs(now).endOf("day").toDate(), "23:59"),
    });
  }

  function applyThisYear() {
    const now = dayjs();
    onChange({
      from: applyTime(now.startOf("year").toDate(), "00:00"),
      to: applyTime(now.endOf("year").toDate(), "23:59"),
    });
  }

  const label = from
    ? to
      ? hideTime
        ? `${format(from, "dd/MM/yy", { locale: ptBR })} – ${format(to, "dd/MM/yy", { locale: ptBR })}`
        : `${format(from, "dd/MM/yy HH:mm", { locale: ptBR })} – ${format(to, "dd/MM/yy HH:mm", { locale: ptBR })}`
      : hideTime
        ? format(from, "dd/MM/yy", { locale: ptBR })
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
            triggerClassName,
          )}
        >
          <CalendarIcon className="mr-1.5 size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto p-0"
        align="start"
      >
        <Calendar
          locale={pt}
          mode="range"
          timeZone="America/Sao_Paulo"
          defaultMonth={from}
          selected={{ from, to }}
          onSelect={handleRangeSelect}
          numberOfMonths={isMobile ? 1 : 2}
        />

        {!hideTime && (
          <div className="grid grid-cols-2 gap-2 border-t p-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Início
              </Label>
              <Input
                type="time"
                value={fromTime}
                onChange={(event) => handleFromTimeChange(event.target.value)}
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
                onChange={(event) => handleToTimeChange(event.target.value)}
                className="h-8 text-xs"
                disabled={!to}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange({ from: undefined, to: undefined })}
          >
            Limpar
          </Button>
          <div className="flex flex-wrap justify-start gap-1.5 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={applyThisMonth}
            >
              Este mês
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={applyLastMonth}
            >
              Mês passado
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyLastDays(30)}
            >
              30 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={applyThisYear}
            >
              Este ano
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Helper — atalho pra "primeiro dia do mês corrente". */
export function currentMonthRange(): { from: Date; to: Date } {
  const now = dayjs();
  return {
    from: now.startOf("month").toDate(),
    to: now.endOf("month").toDate(),
  };
}
