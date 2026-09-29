"use client";

import { useMemo, useState } from "react";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPickedDate,
  formatPickedDateTime,
  type AstroPicker,
} from "@/features/astro/lib/astro-picker";

type DateTimePicker = Extract<AstroPicker, { kind: "datetime" }>;

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const BRAZIL_OFFSET = "-03:00";
const QUICK_DAY_COUNT = 7;
const QUICK_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

/** "2026-09-26" e "13:00" no relógio de Brasília. */
function toBrazilParts(instant: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

function toInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${BRAZIL_OFFSET}`);
}

function formatLongDateTime(instant: Date): string {
  const day = instant.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  const time = instant.toLocaleTimeString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, às ${time}`;
}

function formatLongDate(instant: Date): string {
  return instant.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function quickDays(now: Date): { date: string; label: string }[] {
  return Array.from({ length: QUICK_DAY_COUNT }, (_, offset) => {
    const instant = new Date(now.getTime() + offset * 24 * 60 * 60_000);
    const { date } = toBrazilParts(instant);
    const label =
      offset === 0
        ? "Hoje"
        : offset === 1
          ? "Amanhã"
          : instant.toLocaleDateString("pt-BR", {
              timeZone: BRAZIL_TIME_ZONE,
              weekday: "short",
              day: "2-digit",
            });
    return { date, label };
  });
}

/**
 * Seletor de dia e hora no cartão: o ASTRO recebe uma data exata, sem
 * "amanhãs as 13h" para interpretar (spec 0033, RF-3).
 */
export function AstroDateTimePicker({
  picker,
  onPick,
  disabled,
}: {
  picker: DateTimePicker;
  onPick: (answer: string) => void;
  disabled?: boolean;
}) {
  const now = useMemo(() => new Date(), []);
  const suggested = picker.suggestedIso
    ? toBrazilParts(new Date(picker.suggestedIso))
    : null;
  const [date, setDate] = useState(suggested?.date ?? "");
  const [time, setTime] = useState(
    picker.mode === "time" ? "" : (suggested?.time ?? ""),
  );

  const isDateOnly = picker.mode === "date";
  const today = toBrazilParts(now).date;
  const chosen =
    date && (time || isDateOnly)
      ? toInstant(date, isDateOnly ? "12:00" : time)
      : null;
  const isPast = isDateOnly
    ? Boolean(date) && date < today
    : chosen
      ? chosen.getTime() < now.getTime()
      : false;
  const blocksPast = isPast && !picker.allowPast;
  const canConfirm = Boolean(chosen) && !blocksPast && !disabled;

  return (
    <div className="space-y-3">
      {picker.mode !== "time" && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
            <CalendarIcon className="size-3" /> Dia
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickDays(now).map((quickDay) => (
              <button
                key={quickDay.date}
                type="button"
                disabled={disabled}
                onClick={() => setDate(quickDay.date)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                  date === quickDay.date
                    ? "bg-violet-500 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                )}
              >
                {quickDay.label}
              </button>
            ))}
            <input
              type="date"
              min={picker.allowPast ? undefined : today}
              value={date}
              disabled={disabled}
              onChange={(event) => setDate(event.target.value)}
              className="h-7 rounded-md border border-zinc-700 bg-zinc-950/60 px-2 text-xs text-zinc-200 [color-scheme:dark]"
            />
          </div>
        </div>
      )}

      {!isDateOnly && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
            <ClockIcon className="size-3" /> Horário
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TIMES.map((quickTime) => (
              <button
                key={quickTime}
                type="button"
                disabled={disabled}
                onClick={() => setTime(quickTime)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs tabular-nums transition-colors",
                  time === quickTime
                    ? "bg-violet-500 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                )}
              >
                {quickTime}
              </button>
            ))}
            <input
              type="time"
              step={900}
              value={time}
              disabled={disabled}
              onChange={(event) => setTime(event.target.value)}
              className="h-7 rounded-md border border-zinc-700 bg-zinc-950/60 px-2 text-xs text-zinc-200 [color-scheme:dark]"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950/50 px-3 py-2">
        <p
          className={cn(
            "text-xs",
            blocksPast
              ? "text-amber-400"
              : chosen
                ? "text-zinc-100"
                : "text-zinc-500",
          )}
        >
          {chosen
            ? blocksPast
              ? "Esse horário já passou."
              : isDateOnly
                ? formatLongDate(chosen)
                : formatLongDateTime(chosen)
            : picker.mode === "time"
              ? "Escolha o horário"
              : isDateOnly
                ? "Escolha o dia"
                : "Escolha o dia e o horário"}
        </p>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() =>
            chosen &&
            onPick(
              isDateOnly
                ? formatPickedDate(date)
                : formatPickedDateTime(date, time),
            )
          }
          className="shrink-0 rounded-md bg-violet-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isDateOnly ? "Usar esta data" : "Usar este horário"}
        </button>
      </div>

      {picker.skipOption && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(picker.skipOption!.answer)}
          className="w-full rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          {picker.skipOption.label}
        </button>
      )}
    </div>
  );
}
