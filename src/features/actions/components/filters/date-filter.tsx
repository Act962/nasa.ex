"use client";

import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { pt } from "react-day-picker/locale";
import dayjs from "dayjs";
import { useActionFilters } from "../../hooks/use-action-filters";
import { cn } from "@/lib/utils";

const DATE_INTERVALS = [
  { label: "Hoje", from: () => dayjs().toDate(), to: () => dayjs().toDate() },
  {
    label: "Semana",
    from: () => dayjs().day(0).toDate(),
    to: () => dayjs().day(6).toDate(),
  },
  {
    label: "Mês",
    from: () => dayjs().startOf("month").toDate(),
    to: () => dayjs().endOf("month").toDate(),
  },
  {
    label: "Ano",
    from: () => dayjs().startOf("year").toDate(),
    to: () => dayjs().endOf("year").toDate(),
  },
  {
    label: "Últimos 7d",
    from: () => dayjs().subtract(6, "day").toDate(),
    to: () => dayjs().toDate(),
  },
  {
    label: "Últimos 30d",
    from: () => dayjs().subtract(29, "day").toDate(),
    to: () => dayjs().toDate(),
  },
];

interface Props {
  variant?: "popover" | "list";
}

export function DateFilter({ variant = "popover" }: Props) {
  const { filters, setFilters } = useActionFilters();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(
    undefined,
  );

  const handleCalendarOpen = (open: boolean) => {
    if (open) {
      setPendingRange({
        from: filters.dueDateFrom ?? undefined,
        to: filters.dueDateTo ?? undefined,
      });
    }
    setCalendarOpen(open);
  };

  const handleApplyDate = () => {
    setFilters({
      ...filters,
      dueDateFrom: pendingRange?.from
        ? dayjs(pendingRange.from).startOf("day").toDate()
        : null,
      dueDateTo: pendingRange?.to
        ? dayjs(pendingRange.to).endOf("day").toDate()
        : null,
    });
    setCalendarOpen(false);
  };

  const handleResetDate = () => {
    setPendingRange(undefined);
    setFilters({ ...filters, dueDateFrom: null, dueDateTo: null });
    setCalendarOpen(false);
  };

  const isActive = !!(filters.dueDateFrom || filters.dueDateTo);
  const dateLabel = isActive
    ? `${filters.dueDateFrom ? dayjs(filters.dueDateFrom).format("DD/MM") : "..."} – ${filters.dueDateTo ? dayjs(filters.dueDateTo).format("DD/MM") : "..."}`
    : "Filtrar por data";

  const trigger = (
    <Button
      variant={isActive ? "secondary" : "outline"}
      size="sm"
      className={cn(
        "h-7 gap-1.5 text-xs",
        variant === "list" && "w-full justify-start h-9",
      )}
    >
      <CalendarIcon className="size-3" />
      {variant === "list" && !isActive ? "Selecionar datas" : dateLabel}
      {variant === "popover" && isActive && (
        <span className="text-muted-foreground ml-1">{dateLabel}</span>
      )}
    </Button>
  );

  return (
    <div className={cn(variant === "list" && "space-y-2")}>
      {variant === "list" && (
        <h4 className="text-sm font-medium flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          Período (Prazo)
        </h4>
      )}
      <Popover open={calendarOpen} onOpenChange={handleCalendarOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align={variant === "list" ? "center" : "start"}
          className="p-0 border rounded-lg shadow-sm w-fit flex overflow-hidden flex-col md:flex-row"
        >
          <div
            className={cn(
              "flex flex-col gap-0.5 border-b md:border-b-0 md:border-r border-border p-2",
              // variant === "list"
              //   ? "w-full grid grid-cols-3 md:grid-cols-1"
              //   : "w-36",
            )}
          >
            {DATE_INTERVALS.map((interval) => (
              <Button
                key={interval.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 px-2"
                onClick={() =>
                  setPendingRange({ from: interval.from(), to: interval.to() })
                }
              >
                {interval.label}
              </Button>
            ))}
          </div>
          <div className="bg-background">
            <Calendar
              mode="range"
              defaultMonth={pendingRange?.from}
              selected={pendingRange}
              onSelect={setPendingRange}
              numberOfMonths={2}
              locale={pt}
              timeZone="America/Sao_Paulo"
              className="border-none"
            />
            <div className="flex justify-end gap-2 p-2 border-t">
              {isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetDate}
                  className="h-8 text-xs"
                >
                  Resetar
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleApplyDate}
                className="h-8 text-xs"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
