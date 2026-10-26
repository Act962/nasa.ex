"use client";

// Campo de data do financeiro com o calendário do app, no lugar do `<input type="date">`
// nativo (que muda de cara em cada navegador e ignorava digitação em alguns). Fala o mesmo
// formato do input nativo — "AAAA-MM-DD" — para trocar sem mexer no estado de quem usa.

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { pt } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function toLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDateValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

interface DateFieldProps {
  /** "AAAA-MM-DD" ou vazio. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** "AAAA-MM-DD": dias antes deste ficam bloqueados. */
  min?: string;
  isInvalid?: boolean;
  className?: string;
  /** Mostra "Limpar" (para filtros, onde vazio significa "sem filtro"). */
  isClearable?: boolean;
}

export function DateField({
  value,
  onChange,
  placeholder = "Escolha a data",
  min,
  isInvalid = false,
  className,
  isClearable = false,
}: DateFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = toLocalDate(value);
  const minDate = min ? toLocalDate(min) : undefined;

  return (
    // `modal`: dentro de um Dialog, o calendário fica num portal fora dele e precisa liberar
    // o próprio foco e rolagem.
    <Popover open={isOpen} onOpenChange={setIsOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-invalid={isInvalid}
          className={cn(
            "h-9 w-full justify-start gap-2 px-4 text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          {selected ? selected.toLocaleDateString("pt-BR") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={pt}
          selected={selected}
          defaultMonth={selected ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(toDateValue(date));
            setIsOpen(false);
          }}
          autoFocus
        />
        <div className="flex justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onChange(toDateValue(new Date()));
              setIsOpen(false);
            }}
          >
            Hoje
          </Button>
          {isClearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
