"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import dayjs from "dayjs";
import { pt } from "react-day-picker/locale";
import { useQueryState } from "nuqs";

export function CalendarFilter() {
  const [open, setOpen] = useState(false);
  const [dateInit, setDateInit] = useQueryState("date_init");
  const [dateEnd, setDateEnd] = useQueryState("date_end");

  // ✅ Use useMemo para memoizar as datas e evitar criar novos objetos a cada render
  const initialDateRange = useMemo<DateRange | undefined>(() => {
    return {
      from: dateInit ? dayjs(dateInit).toDate() : dayjs().day(0).toDate(),
      to: dateEnd ? dayjs(dateEnd).toDate() : dayjs().day(6).toDate(),
    };
  }, [dateInit, dateEnd]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialDateRange,
  );

  const handleApply = () => {
    if (dateRange?.from) {
      setDateInit(dayjs(dateRange.from).format("YYYY-MM-DD"));
    }
    if (dateRange?.to) {
      setDateEnd(dayjs(dateRange.to).format("YYYY-MM-DD"));
    }
    setOpen(false);
  };

  const intervals = [
    {
      label: "Hoje",
      from: dayjs().toDate(),
      to: dayjs().toDate(),
    },
    {
      label: "Semana",
      from: dayjs().day(0).toDate(),
      to: dayjs().day(6).toDate(),
    },
    {
      label: "Mês",
      from: dayjs().startOf("month").toDate(),
      to: dayjs().endOf("month").toDate(),
    },
    {
      label: "Ano",
      from: dayjs().startOf("year").toDate(),
      to: dayjs().endOf("year").toDate(),
    },
    {
      label: "Últimos 7 Dias",
      from: dayjs().subtract(6, "day").toDate(),
      to: dayjs().toDate(),
    },
    {
      label: "Últimos 30 Dias",
      from: dayjs().subtract(29, "day").toDate(),
      to: dayjs().toDate(),
    },
  ];

  const isActiveFilter = dateInit && dateEnd;

  const handleResetFilter = () => {
    setDateInit(null);
    setDateEnd(null);
    setDateRange({
      from: dayjs().toDate(),
      to: dayjs().toDate(),
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActiveFilter ? "default" : "outline"}
          className="justify-start"
          size="sm"
        >
          <CalendarIcon className="size-4" />
          Calendário
          {isActiveFilter && (
            <>
              <span className="text-sm text-muted-foreground">
                {`${dayjs(dateInit).format("DD/MM/YYYY")} - ${dayjs(
                  dateEnd,
                ).format("DD/MM/YYYY")}`}
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 border rounded-lg shadow-sm w-fit flex overflow-hidden"
      >
        <div className="hidden md:flex flex-col gap-0.5 border-r border-border w-36 px-2 py-2">
          {intervals.map((interval) => (
            <Button
              key={interval.label}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => setDateRange(interval)}
            >
              {interval.label}
            </Button>
          ))}
        </div>
        <div className="bg-background">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            locale={pt}
            timeZone="America/Sao_Paulo"
            className="border-none"
          />

          <div className="flex justify-end gap-2 p-2">
            {isActiveFilter && (
              <Button variant="outline" onClick={handleResetFilter}>
                Resetar
              </Button>
            )}
            <Button onClick={handleApply}>Aplicar</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
