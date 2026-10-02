"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorSwatchPickerProps {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
  /** Mostra também o campo com o código da cor (ex.: #6366f1). */
  hasHexInput?: boolean;
  label: string;
}

/** Amostras redondas + seletor livre para cores que o cliente escolhe para a página pública. */
export function ColorSwatchPicker({ colors, value, onChange, hasHexInput = false, label }: ColorSwatchPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`${label}: ${color}`}
            aria-pressed={value === color}
            className={cn(
              "size-8 rounded-full border-2 transition-transform hover:scale-110",
              value === color ? "scale-110 border-foreground" : "border-line",
            )}
            style={{ background: color }}
          />
        ))}
        {!hasHexInput && (
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="size-8 cursor-pointer border"
            aria-label={`${label}: outra cor`}
          />
        )}
      </div>
      {hasHexInput && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="size-9 shrink-0 cursor-pointer border"
            aria-label={`${label}: outra cor`}
          />
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 min-w-0 font-mono text-sm"
            aria-label={`${label}: código da cor`}
          />
        </div>
      )}
    </div>
  );
}
