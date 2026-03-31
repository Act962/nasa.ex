import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { useLocale } from "react-aria";

// Locales
import "dayjs/locale/pt-br";

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  className?: string;
  placeholder?: string;
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "Selecione uma data",
}: DatePickerProps) {
  const { locale } = useLocale();

  const [hour, setHour] = useState<string>(
    value ? String(dayjs(value).hour()).padStart(2, "0") : "00",
  );
  const [minute, setMinute] = useState<string>(
    value ? String(dayjs(value).minute()).padStart(2, "0") : "00",
  );

  // Sync time inputs when value changes externally
  useEffect(() => {
    if (value) {
      setHour(String(dayjs(value).hour()).padStart(2, "0"));
      setMinute(String(dayjs(value).minute()).padStart(2, "0"));
    }
  }, [value]);

  const handleDaySelect = (date: Date | undefined) => {
    if (!date) return;
    const h = Math.min(23, Math.max(0, parseInt(hour) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minute) || 0));
    onChange(dayjs(date).hour(h).minute(m).second(0).toDate());
  };

  const applyTime = (newHour: string, newMinute: string) => {
    if (!value) return;
    const h = Math.min(23, Math.max(0, parseInt(newHour) || 0));
    const m = Math.min(59, Math.max(0, parseInt(newMinute) || 0));
    onChange(dayjs(value).hour(h).minute(m).second(0).toDate());
  };

  const formatLabel = (date: Date) => {
    const d = dayjs(date).locale(locale);
    const hasTime = d.hour() !== 0 || d.minute() !== 0;
    return hasTime ? d.format("DD/MM/YYYY HH:mm") : d.format("DD/MM/YYYY");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={cn(
            "w-full justify-start text-left font-normal px-3",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {value ? (
            <span>{formatLabel(value)}</span>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => handleDaySelect(date as Date)}
          autoFocus
        />

        {/* Time picker */}
        <div className="border-t px-3 py-2.5 flex items-center gap-2">
          <ClockIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Horário</span>
          <div className="flex items-center gap-1 ml-auto">
            <Input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => {
                const v = e.target.value.slice(-2);
                setHour(v);
                applyTime(v, minute);
              }}
              onBlur={() => {
                const padded = String(
                  Math.min(23, Math.max(0, parseInt(hour) || 0)),
                ).padStart(2, "0");
                setHour(padded);
                applyTime(padded, minute);
              }}
              className="h-7 w-12 text-center text-xs px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-sm font-bold text-muted-foreground">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(e) => {
                const v = e.target.value.slice(-2);
                setMinute(v);
                applyTime(hour, v);
              }}
              onBlur={() => {
                const padded = String(
                  Math.min(59, Math.max(0, parseInt(minute) || 0)),
                ).padStart(2, "0");
                setMinute(padded);
                applyTime(hour, padded);
              }}
              className="h-7 w-12 text-center text-xs px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
