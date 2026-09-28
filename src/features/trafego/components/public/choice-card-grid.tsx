"use client";

import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChoiceCardOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Grade de cards quadrados (1:1) para escolha única.
 *
 * Três colunas no desktop, duas no mobile — em telas pequenas um card 1:1 em
 * três colunas fica estreito demais para o rótulo caber.
 */
export function ChoiceCardGrid<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: ChoiceCardOption<T>[];
  value: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3"
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.value)}
            className={cn(
              "group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition sm:p-4",
              isSelected
                ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(167,139,250,0.35)]"
                : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]",
            )}
          >
            {isSelected && (
              <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-violet-500">
                <Check className="size-2.5 text-white" />
              </span>
            )}

            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl transition sm:size-12",
                isSelected
                  ? "bg-violet-500/25 text-violet-100"
                  : "bg-white/[0.06] text-white/55 group-hover:text-white/80",
              )}
            >
              <Icon className="size-5 sm:size-6" />
            </span>

            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "text-xs font-semibold leading-tight sm:text-sm",
                  isSelected ? "text-white" : "text-white/80",
                )}
              >
                {option.label}
              </span>
              <span className="text-[10px] leading-snug text-white/40 sm:text-xs">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
