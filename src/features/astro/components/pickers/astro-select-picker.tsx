"use client";

import type { AstroPicker } from "@/features/astro/lib/astro-picker";

type SelectPicker = Extract<AstroPicker, { kind: "select" }>;

/** Opções fixas — "Online" ou "Presencial" — sem nada para digitar. */
export function AstroSelectPicker({
  picker,
  onPick,
  disabled,
}: {
  picker: SelectPicker;
  onPick: (answer: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {picker.options.map((option) => (
        <button
          key={option.answer}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option.answer)}
          className="rounded-lg bg-info/15 px-3.5 py-2 text-sm font-medium text-info transition-colors hover:bg-info/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
