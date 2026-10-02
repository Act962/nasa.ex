"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LinnkerImageUploader } from "../linnker-image-uploader";
import { ColorSwatchPicker } from "./color-swatch-picker";
import { PRESET_BACKGROUND_COLORS } from "./appearance-options";
import type { AppearanceDraft, UpdateAppearanceDraft } from "./appearance-draft";

interface AppearanceSectionProps {
  draft: AppearanceDraft;
  onChange: UpdateAppearanceDraft;
}

export function AppearanceBackgroundSection({ draft, onChange }: AppearanceSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Cor de fundo</Label>
        <ColorSwatchPicker
          colors={PRESET_BACKGROUND_COLORS}
          value={draft.backgroundColor}
          onChange={(backgroundColor) => onChange({ backgroundColor })}
          label="Cor de fundo"
          hasHexInput
        />
      </div>

      <LinnkerImageUploader
        value={draft.backgroundImage}
        onChange={(backgroundImage) => onChange({ backgroundImage })}
        label="Imagem de fundo (opcional)"
        aspectRatio="banner"
      />

      {draft.backgroundImage && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Transparência da imagem</Label>
            <span className="font-mono text-xs text-muted-foreground">{Math.round(draft.backgroundOpacity * 100)}%</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[draft.backgroundOpacity]}
            onValueChange={([backgroundOpacity]) => onChange({ backgroundOpacity })}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Transparente</span>
            <span>Opaca</span>
          </div>
        </div>
      )}

      <div className="relative h-16 w-full overflow-hidden rounded-[18px] border border-line" style={{ background: draft.backgroundColor }}>
        {draft.backgroundImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.backgroundImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: draft.backgroundOpacity }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm font-bold drop-shadow" style={{ color: draft.coverColor }}>Prévia do fundo</p>
        </div>
      </div>
    </div>
  );
}
