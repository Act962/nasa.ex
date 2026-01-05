"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import dayjs from "dayjs";
import { pt } from "react-day-picker/locale";
import { useQueryState } from "nuqs";

export function CalendarFilter() {
  const [open, setOpen] = useState(false);
  const [dateInit, setDateInit] = useQueryState("date_init");
  const [dateEnd, setDateEnd] = useQueryState("date_end");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: dayjs(dateInit || dayjs().day(0).toDate()).toDate(),
    to: dayjs(dateEnd || dayjs().day(6).toDate()).toDate(),
  });

  const handleApply = () => {
    setDateInit(dayjs(dateRange?.from).format("YYYY-MM-DD"));
    setDateEnd(dayjs(dateRange?.to).format("YYYY-MM-DD"));

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

        <div className="flex justify-end p-2">
          <Button onClick={handleApply}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
