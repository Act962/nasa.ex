"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toDayKey } from "@/features/form-records/lib/records-summary";

// Filtro de datas da lista de fichas: atalhos prontos e intervalo livre. As
// datas são dias de Brasília, "AAAA-MM-DD", os dois inclusivos.

export interface DateRangeValue {
  presetId: string;
  dateFrom?: string;
  dateTo?: string;
}

export const ALL_TIME_RANGE: DateRangeValue = { presetId: "all" };
const CUSTOM_PRESET_ID = "custom";

const shiftDays = (dayKey: string, days: number): string => {
  const date = new Date(`${dayKey}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDayKey(date);
};
const lastDayOfMonth = (year: number, month: number): string => `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;

function buildPresets(todayKey: string): { id: string; label: string; dateFrom?: string; dateTo?: string }[] {
  const [year, month] = todayKey.split("-").map(Number);
  const previousMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  return [
    { id: "all", label: "Todo o período" },
    { id: "today", label: "Hoje", dateFrom: todayKey, dateTo: todayKey },
    { id: "last-7", label: "Últimos 7 dias", dateFrom: shiftDays(todayKey, -6), dateTo: todayKey },
    { id: "last-30", label: "Últimos 30 dias", dateFrom: shiftDays(todayKey, -29), dateTo: todayKey },
    { id: "this-month", label: "Este mês", dateFrom: `${todayKey.slice(0, 7)}-01`, dateTo: lastDayOfMonth(year, month) },
    {
      id: "last-month",
      label: "Mês passado",
      dateFrom: `${previousMonth.year}-${String(previousMonth.month).padStart(2, "0")}-01`,
      dateTo: lastDayOfMonth(previousMonth.year, previousMonth.month),
    },
    { id: "last-90", label: "Últimos 90 dias", dateFrom: shiftDays(todayKey, -89), dateTo: todayKey },
    { id: "this-year", label: "Este ano", dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` },
  ];
}

const formatDay = (dayKey: string) => dayKey.split("-").reverse().join("/");

function describeRange(value: DateRangeValue, presets: ReturnType<typeof buildPresets>): string {
  const preset = presets.find((candidate) => candidate.id === value.presetId);
  if (preset) return preset.label;
  if (value.dateFrom && value.dateTo) return `${formatDay(value.dateFrom)} – ${formatDay(value.dateTo)}`;
  if (value.dateFrom) return `Desde ${formatDay(value.dateFrom)}`;
  if (value.dateTo) return `Até ${formatDay(value.dateTo)}`;
  return "Todo o período";
}

export function DateRangeFilter({ value, onChange }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.dateFrom ?? "");
  const [customTo, setCustomTo] = useState(value.dateTo ?? "");
  const presets = buildPresets(toDayKey(new Date()));
  const isCustomInverted = Boolean(customFrom && customTo && customFrom > customTo);

  const choose = (nextValue: DateRangeValue) => {
    onChange(nextValue);
    setCustomFrom(nextValue.dateFrom ?? "");
    setCustomTo(nextValue.dateTo ?? "");
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label="Período" data-guide={GUIDE_ANCHORS.formRecordsDateFilter.id} className="justify-start gap-2 font-normal">
          <CalendarDays className="size-4 text-muted-foreground" />
          {describeRange(value, presets)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="grid grid-cols-2 gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={value.presetId === preset.id ? "default" : "ghost"}
              className="justify-start"
              onClick={() => choose({ presetId: preset.id, dateFrom: preset.dateFrom, dateTo: preset.dateTo })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Intervalo de datas</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="records-date-from" className="text-xs">
                De
              </Label>
              <Input id="records-date-from" type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="records-date-to" className="text-xs">
                Até
              </Label>
              <Input id="records-date-to" type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          </div>
          {isCustomInverted && <p className="text-xs text-destructive">A data inicial é depois da final.</p>}
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={(!customFrom && !customTo) || isCustomInverted}
            onClick={() => choose({ presetId: CUSTOM_PRESET_ID, dateFrom: customFrom || undefined, dateTo: customTo || undefined })}
          >
            Aplicar intervalo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
