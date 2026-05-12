"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  id: string;
  label: string;
  /** Cor opcional do chip (hex/rgb). Usada em tags/status. */
  color?: string | null;
};

type Props = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Multi-select com checkbox + chips, usado nos triggers de "Zerar
 * Cronômetro" do DatePicker. Compacto pra caber na sidebar de
 * propriedades. Reusável pra Tracking/Status/Tags/Forms/Grupos —
 * cada caller fornece a lista própria (via hooks de cada feature).
 *
 * UX:
 *  - Trigger: botão outlined mostrando placeholder OU chips compactos.
 *  - Popover: Command (cmdk) com search + lista de checkboxes.
 *  - Clear-all: X no chip individual ou clique novamente no checkbox.
 */
export function MultiSelectChips({
  options,
  value,
  onChange,
  placeholder = "Selecione…",
  emptyMessage = "Nada encontrado.",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const selectedOptions = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is MultiSelectOption => !!o);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "w-full justify-between h-auto min-h-8 px-2 py-1 text-xs font-normal",
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 items-center min-w-0">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((o) => (
                <Badge
                  key={o.id}
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] gap-1 max-w-[120px]"
                  style={
                    o.color
                      ? { backgroundColor: `${o.color}30`, color: o.color, borderColor: `${o.color}60` }
                      : undefined
                  }
                  // onPointerDown stopPropagation evita abrir o popover
                  // quando o user clica direto no X de remover.
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{o.label}</span>
                  <button
                    type="button"
                    className="hover:opacity-70"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(o.id);
                    }}
                    aria-label={`Remover ${o.label}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="size-3 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = value.includes(opt.id);
                return (
                  <CommandItem
                    key={opt.id}
                    value={opt.label}
                    onSelect={() => toggle(opt.id)}
                    className="text-xs cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary",
                        checked
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-3" />
                    </div>
                    {opt.color && (
                      <span
                        className="inline-block size-2 rounded-full mr-1.5"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
