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
          className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canConfirm}
          className="h-9 shrink-0 rounded-lg bg-violet-500 px-3 text-xs font-medium text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Usar
        </button>
      </form>
      {picker.skipOption && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(picker.skipOption!.answer)}
          className="w-full rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          {picker.skipOption.label}
        </button>
      )}
    </div>
  );
}
