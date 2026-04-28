"use client";

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { variables } from "./variables";

interface VariablePickerProps {
  onSelect: (variable: string) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function VariablePicker({
  onSelect,
  open,
  onOpenChange,
  search,
  onSearchChange,
}: VariablePickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="sr-only" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput
            placeholder="Filtrar variáveis..."
            value={search}
            onValueChange={onSearchChange}
          />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>Nenhuma variável encontrada.</CommandEmpty>
            <CommandGroup heading="Variáveis Disponíveis">
              {Object.entries(variables).map(([key, label]) => (
                <CommandItem
                  key={key}
                  value={label}
                  onSelect={() => onSelect(key)}
                  className="cursor-pointer"
                >
                  <span className="font-mono text-xs mr-2">{key}</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
