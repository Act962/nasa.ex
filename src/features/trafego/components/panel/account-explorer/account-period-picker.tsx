"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { pt } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  MAX_CUSTOM_PERIOD_MONTHS,
  type AccountPeriodSelection,
  type AccountRange,
} from "@/features/trafego/lib/order-meta-metrics";

/** Atalhos de período e calendário para datas livres (mesmo padrão do filtro de data do Workspace). */

const PRESET_OPTIONS: { key: AccountRange; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "last_7d", label: "7 dias" },
  { key: "last_30d", label: "30 dias" },
  { key: "last_90d", label: "90 dias" },
];

const CALENDAR_SHORTCUTS: { label: string; from: () => Date; to: () => Date }[] = [
  { label: "Hoje", from: () => dayjs().toDate(), to: () => dayjs().toDate() },
  { label: "Ontem", from: () => dayjs().subtract(1, "day").toDate(), to: () => dayjs().subtract(1, "day").toDate() },
  { label: "Últimos 7d", from: () => dayjs().subtract(6, "day").toDate(), to: () => dayjs().toDate() },
  { label: "Últimos 30d", from: () => dayjs().subtract(29, "day").toDate(), to: () => dayjs().toDate() },
  { label: "Este mês", from: () => dayjs().startOf("month").toDate(), to: () => dayjs().toDate() },
  {
    label: "Mês passado",
    from: () => dayjs().subtract(1, "month").startOf("month").toDate(),
    to: () => dayjs().subtract(1, "month").endOf("month").toDate(),
  },
];

const DATE_ONLY_FORMAT = "YYYY-MM-DD";

/** `AAAA-MM-DD` vira meia-noite local, como o calendário marca os dias. */
function toCalendarDate(dateOnly: string): Date {
  return dayjs(dateOnly).toDate();
}

function describeCustomPeriod(period: Extract<AccountPeriodSelection, { range: "custom" }>): string {
  const since = toCalendarDate(period.since);
  const until = toCalendarDate(period.until);
  const isSameYear = dayjs(since).year() === dayjs(until).year() && dayjs(until).year() === dayjs().year();
  const format = isSameYear ? "DD/MM" : "DD/MM/YY";
  return period.since === period.until
    ? dayjs(since).format(format)
    : `${dayjs(since).format(format)} – ${dayjs(until).format(format)}`;
}

export function AccountPeriodPicker({
  value,
  onChange,
}: {
  value: AccountPeriodSelection;
  onChange: (period: AccountPeriodSelection) => void;
}) {
  const isMobile = useIsMobile();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  const isCustom = value.range === "custom";
  const oldestSelectableDate = dayjs().subtract(MAX_CUSTOM_PERIOD_MONTHS, "month").add(1, "day").startOf("day").toDate();

  function handleCalendarOpenChange(isOpen: boolean) {
    if (isOpen) {
      setPendingRange(
        value.range === "custom"
          ? { from: toCalendarDate(value.since), to: toCalendarDate(value.until) }
          : undefined,
      );
    }
    setIsCalendarOpen(isOpen);
  }

  function handleApply() {
    if (!pendingRange?.from) return;
    onChange({
      range: "custom",
      since: dayjs(pendingRange.from).format(DATE_ONLY_FORMAT),
      until: dayjs(pendingRange.to ?? pendingRange.from).format(DATE_ONLY_FORMAT),
    });
    setIsCalendarOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {PRESET_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange({ range: option.key })}
          aria-pressed={value.range === option.key}
          className={cn(
            "min-h-8 rounded-full px-3 text-xs transition",
            value.range === option.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}

      <Popover open={isCalendarOpen} onOpenChange={handleCalendarOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-pressed={isCustom}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs transition",
              isCustom ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-3.5" />
            {value.range === "custom" ? describeCustomPeriod(value) : "Personalizado"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="flex w-fit flex-col overflow-hidden rounded-lg border p-0 shadow-sm md:flex-row"
        >
          <div className="grid grid-cols-3 gap-0.5 border-b border-border p-2 md:flex md:flex-col md:border-r md:border-b-0">
            {CALENDAR_SHORTCUTS.map((shortcut) => (
              <Button
                key={shortcut.label}
                variant="ghost"
                size="sm"
                className="h-7 justify-start px-2 text-xs"
                onClick={() => setPendingRange({ from: shortcut.from(), to: shortcut.to() })}
              >
                {shortcut.label}
              </Button>
            ))}
          </div>
          <div className="bg-background">
            <Calendar
              mode="range"
              defaultMonth={pendingRange?.from ?? dayjs().subtract(isMobile ? 0 : 1, "month").toDate()}
              selected={pendingRange}
              onSelect={setPendingRange}
              numberOfMonths={isMobile ? 1 : 2}
              locale={pt}
              disabled={{ before: oldestSelectableDate, after: new Date() }}
              className="border-none"
            />
            <div className="flex items-center justify-end gap-2 border-t p-2">
              {pendingRange?.from && (
                <span className="mr-auto text-xs text-muted-foreground">
                  {dayjs(pendingRange.from).format("DD/MM/YY")}
                  {pendingRange.to ? ` – ${dayjs(pendingRange.to).format("DD/MM/YY")}` : ""}
                </span>
              )}
              <Button size="sm" onClick={handleApply} disabled={!pendingRange?.from} className="h-8 text-xs">
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
