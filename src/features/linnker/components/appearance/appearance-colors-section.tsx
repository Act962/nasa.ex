"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ColorSwatchPicker } from "./color-swatch-picker";
import { BUTTON_STYLES, PRESET_COVER_COLORS } from "./appearance-options";
import type { AppearanceDraft, UpdateAppearanceDraft } from "./appearance-draft";

interface AppearanceSectionProps {
  draft: AppearanceDraft;
  onChange: UpdateAppearanceDraft;
}

export function AppearanceColorsSection({ draft, onChange }: AppearanceSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Cor principal dos botões</Label>
        <ColorSwatchPicker
          colors={PRESET_COVER_COLORS}
          value={draft.coverColor}
          onChange={(coverColor) => onChange({ coverColor })}
          label="Cor principal"
          hasHexInput
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Formato dos botões</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Formato dos botões">
          {BUTTON_STYLES.map((buttonStyle) => {
            const isActive = draft.buttonStyle === buttonStyle.value;
            return (
              <button
                key={buttonStyle.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onChange({ buttonStyle: buttonStyle.value })}
                className={cn(
                  "rounded-[18px] border-2 p-3 transition-colors",
                  isActive ? "border-foreground bg-muted" : "border-line hover:border-muted-foreground",
                )}
              >
                <div
                  className={cn("h-8 w-full", buttonStyle.previewClassName)}
                  style={{ background: draft.coverColor, opacity: 0.7 }}
                />
                <p className="mt-2 text-center text-xs font-medium">{buttonStyle.label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
