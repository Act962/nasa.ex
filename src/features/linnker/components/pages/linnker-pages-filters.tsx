"use client";

import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type LinnkerStatusFilter = "all" | "published" | "draft";

interface LinnkerPagesFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  statusFilter: LinnkerStatusFilter;
  onStatusFilterChange: (statusFilter: LinnkerStatusFilter) => void;
  countByStatus: Record<LinnkerStatusFilter, number>;
}

const STATUS_FILTER_OPTIONS: { value: LinnkerStatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "published", label: "Publicadas" },
  { value: "draft", label: "Rascunhos" },
];

export function LinnkerPagesFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  countByStatus,
}: LinnkerPagesFiltersProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
      <div className="relative w-full md:max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar página"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-11 rounded-full pl-10 md:h-9"
          aria-label="Buscar página"
        />
      </div>
      <div className="scroll-hidden-x -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {STATUS_FILTER_OPTIONS.map((option) => {
          const isActive = statusFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusFilterChange(option.value)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-line bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
              <span className={cn("tabular-nums", isActive ? "text-background/70" : "text-muted-foreground/70")}>
                {countByStatus[option.value]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
