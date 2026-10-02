"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterOption {
  id: string;
  name: string;
}

interface FilterMultiSelectProps {
  label: string;
  /** Texto quando nada está marcado (ex.: "Todos os trackings"). */
  allLabel: string;
  options: FilterOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabledHint?: string;
}

/** Seletor múltiplo compacto dos filtros de série do Gráfico Cruzado; vazio = todos. */
export function FilterMultiSelect({ label, allLabel, options, selectedIds, onChange, disabledHint }: FilterMultiSelectProps) {
  const [searchText, setSearchText] = useState("");
  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleOptions = normalizedSearch
    ? options.filter((option) => option.name.toLowerCase().includes(normalizedSearch))
    : options;
  const summary =
    selectedIds.length === 0
      ? allLabel
      : selectedIds.length === 1
        ? (options.find((option) => option.id === selectedIds[0])?.name ?? "1 selecionado")
        : `${selectedIds.length} selecionados`;

  const toggle = (optionId: string) => {
    onChange(
      selectedIds.includes(optionId)
        ? selectedIds.filter((selectedId) => selectedId !== optionId)
        : [...selectedIds, optionId],
    );
  };

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={Boolean(disabledHint)}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-full border border-line bg-card px-3 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
              selectedIds.length > 0 && "border-foreground/40 font-medium",
            )}
          >
            <span className="truncate">{disabledHint ?? summary}</span>
            <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          {options.length > 6 && (
            <label className="mb-1 flex items-center gap-2 rounded-full bg-muted/60 px-3">
              <SearchIcon className="size-3.5 text-muted-foreground" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar…"
                className="h-8 w-full bg-transparent text-xs outline-none"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-left text-xs hover:bg-accent"
          >
            <span className="flex-1">{allLabel}</span>
            {selectedIds.length === 0 && <CheckIcon className="size-3.5" />}
          </button>
          <div className="max-h-60 overflow-y-auto">
            {visibleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="flex-1 truncate">{option.name}</span>
                {selectedIds.includes(option.id) && <CheckIcon className="size-3.5" />}
              </button>
            ))}
            {visibleOptions.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nada encontrado.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
