"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import dayjs from "dayjs";
import { pt } from "react-day-picker/locale";

import { useStatusParams } from "@/features/status/hooks/use-workflow-params";
import { FILTERS } from "@/config/constants";

export function CalendarFilter() {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useStatusParams();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: FILTERS.INIT_DATE,
    to: FILTERS.END_DATE,
  });

  const handleApply = () => {
    console.log(dateRange);

    if (dateRange?.to && dateRange.from) {
      setParams((prev) => ({
        ...prev,
        date_init: dayjs(dateRange.from).startOf("day").toDate(),
        date_end: dayjs(dateRange.to).endOf("day").toDate(),
      }));
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

  const isActiveFilter =
    params.date_init !== FILTERS.INIT_DATE &&
    params.date_end !== FILTERS.END_DATE;

  const handleResetFilter = () => {
    setDateRange({
      from: FILTERS.INIT_DATE,
      to: FILTERS.END_DATE,
    });
    setParams((prev) => ({
      ...prev,
      date_init: FILTERS.INIT_DATE,
      date_end: FILTERS.END_DATE,
    }));
    setOpen(false);
  };

  useEffect(() => {
    if (params.date_init && params.date_end) {
      setDateRange({
        from: params.date_init,
        to: params.date_end,
      });
    }
  }, [params.date_init, params.date_end]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActiveFilter ? "default" : "outline"}
          className="justify-start"
        >
          <CalendarIcon className="size-4" />
          Calendário
          {isActiveFilter && (
            <>
              <span className="text-sm text-muted-foreground">
                {`${dayjs(params.date_init).format("DD/MM/YYYY")} - ${dayjs(
                  params.date_end
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
