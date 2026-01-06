"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
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
    initialDateRange
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

  const handleCancel = () => {
    setDateRange(initialDateRange);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <CalendarIcon className="size-4" />
          Calendário
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 border rounded-lg shadow-sm w-fit"
      >
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
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
