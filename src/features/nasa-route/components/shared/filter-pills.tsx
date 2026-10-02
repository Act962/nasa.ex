"use client";

import { cn } from "@/lib/utils";

export interface FilterPillOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterPillsProps {
  options: FilterPillOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/** Celular: uma linha que rola até a borda; computador: quebra linha. */
export function FilterPills({ options, value, onChange, ariaLabel, className }: FilterPillsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "scroll-hidden-x -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-line bg-card text-foreground hover:bg-muted",
            )}
          >
            <span className="max-w-[60vw] truncate md:max-w-xs">{option.label}</span>
            {typeof option.count === "number" && (
              <span className={cn("tabular-nums", isActive ? "text-background/70" : "text-muted-foreground")}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
