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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  triggerRef,
  open,
  onOpenChange,
  search,
  onSearchChange,
}: VariablePickerProps) {
  // Position the popover near the caret if possible, or just below the input
  // For simplicity and stability with standard inputs/textareas, we'll anchor it to the trigger element

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="sr-only" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[250px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()} // Don't steal focus from input
      >
        <Command>
          <CommandInput
            placeholder="Filtrar variáveis..."
            value={search}
            onValueChange={onSearchChange}
          />
          <CommandList
            className="max-h-[200px] overflow-y-auto"
            data-variable-picker-list=""
            onWheel={(e) => e.stopPropagation()}
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
              [data-variable-picker-list]::-webkit-scrollbar {
                width: 4px !important;
                height: 4px !important;
                display: block !important;
              }
              [data-variable-picker-list]::-webkit-scrollbar-thumb {
                background-color: var(--muted-foreground) !important;
                border-radius: 10px !important;
                opacity: 0.5 !important;
              }
              [data-variable-picker-list]::-webkit-scrollbar-thumb:hover {
                background-color: var(--primary) !important;
              }
            `,
              }}
            />
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
