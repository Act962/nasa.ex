"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LINK_COLORS } from "./link-form-options";

interface LinnkerLinkColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  pageCoverColor: string;
}

export function LinnkerLinkColorPicker({ value, onChange, pageCoverColor }: LinnkerLinkColorPickerProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Cor do botão</Label>
      <div className="flex flex-wrap items-center gap-2">
        {LINK_COLORS.map((color) => (
          <button
            key={color ?? "page-color"}
            type="button"
            onClick={() => onChange(color)}
            aria-label={color === null ? "Cor da página" : `Cor ${color}`}
            aria-pressed={value === color}
            className={cn(
              "size-8 rounded-full border-2 transition-transform hover:scale-110",
              value === color ? "scale-110 border-foreground" : "border-line",
            )}
            style={{ background: color ?? pageCoverColor }}
            title={color === null ? "Cor da página" : color}
          />
        ))}
        <input
          type="color"
          value={value ?? pageCoverColor}
          onChange={(event) => onChange(event.target.value)}
          className="size-8 cursor-pointer border"
          aria-label="Escolher outra cor"
        />
      </div>
      {value === null && (
        <p className="text-[11px] text-muted-foreground">Usando a cor principal da página</p>
      )}
    </div>
  );
}
