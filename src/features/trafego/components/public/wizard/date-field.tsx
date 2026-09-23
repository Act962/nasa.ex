"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { startOfDay } from "@/features/trafego/lib/timeline";
import { cn } from "@/lib/utils";
import { fieldClass } from "./field";

/**
 * Campo de data do wizard. O gatilho é o campo inteiro: no `<input type="date">`
 * só o ícone nativo abria o calendário, e quem clicava no resto do campo achava
 * que estava quebrado.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Selecione uma data",
  minDate,
}: {
  /** Data no formato "yyyy-MM-dd" — string vazia quando não há escolha. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: Date;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseIsoDate(value);
  const earliestSelectable = startOfDay(minDate ?? new Date());

  function handleSelect(date: Date | undefined) {
    onChange(date ? format(date, "yyyy-MM-dd") : "");
    setIsOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            fieldClass,
            "flex items-center justify-between gap-2 text-left hover:border-white/20",
            isOpen && "border-violet-400/60",
          )}
        >
          <span className={cn(!selectedDate && "text-white/25")}>
            {selectedDate
              ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-white/30" />
        </button>
      </PopoverTrigger>

      {/* `dark` fixa os tokens do shadcn no escopo do popover: a landing é
          escura mesmo quando o tema do app está no claro. */}
      <PopoverContent
        align="start"
        className="dark w-auto overflow-hidden rounded-2xl border-white/10 p-0"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate ?? earliestSelectable}
          startMonth={earliestSelectable}
          disabled={{ before: earliestSelectable }}
          locale={ptBR}
          autoFocus
          className="[--cell-size:--spacing(9)]"
        />

        {selectedDate && (
          <button
            type="button"
            onClick={() => handleSelect(undefined)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-white/10 py-2.5 text-xs text-white/45 transition hover:bg-white/[0.04] hover:text-white"
          >
            <X className="size-3.5" />
            Limpar data
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** `new Date("2026-05-08")` é lido como UTC e volta um dia no fuso do Brasil. */
function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}
