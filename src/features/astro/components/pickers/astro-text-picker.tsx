"use client";

import { useState } from "react";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";

type TextPicker = Extract<AstroPicker, { kind: "text" }>;

const MIN_TEXT_LENGTH = 2;

/** Texto curto já sugerido pelo ASTRO: um clique confirma, ou o usuário ajusta. */
export function AstroTextPicker({
  picker,
  onPick,
  disabled,
}: {
  picker: TextPicker;
  onPick: (answer: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(picker.suggestion ?? "");
  const trimmed = value.trim();
  const canConfirm = trimmed.length >= MIN_TEXT_LENGTH && !disabled;

  return (
    <div className="space-y-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canConfirm) onPick(trimmed);
        }}
      >
        <input
          autoFocus
          value={value}
          disabled={disabled}
          maxLength={picker.maxLength ?? 120}
          placeholder={picker.placeholder}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-info/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canConfirm}
          className="h-9 shrink-0 rounded-lg bg-info px-3 text-xs font-medium text-white transition-colors hover:bg-info disabled:cursor-not-allowed disabled:opacity-40"
        >
          Usar
        </button>
      </form>
      {picker.skipOption && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(picker.skipOption!.answer)}
          className="w-full rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-line hover:text-foreground disabled:opacity-50"
        >
          {picker.skipOption.label}
        </button>
      )}
    </div>
  );
}
