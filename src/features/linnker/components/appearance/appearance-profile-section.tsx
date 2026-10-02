"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LinnkerImageUploader } from "../linnker-image-uploader";
import { ColorSwatchPicker } from "./color-swatch-picker";
import { BUTTON_STYLES, PRESET_COVER_COLORS } from "./appearance-options";
import type { AppearanceDraft, UpdateAppearanceDraft } from "./appearance-draft";

interface AppearanceSectionProps {
  draft: AppearanceDraft;
  onChange: UpdateAppearanceDraft;
}

function TextColorInput({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      Cor
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="size-7 cursor-pointer border"
        aria-label={label}
      />
    </label>
  );
}

export function AppearanceProfileSection({ draft, onChange }: AppearanceSectionProps) {
  const { data: resourcesData } = useQuery(orpc.linnker.getResources.queryOptions({}));

  const applyOrgLogo = () => {
    const orgLogo = (resourcesData as { orgLogo?: string | null } | undefined)?.orgLogo ?? null;
    if (orgLogo) {
      onChange({ avatarUrl: orgLogo });
      toast.success("Logo da empresa aplicado!");
    } else {
      toast.error("Nenhum logo encontrado. Cadastre em Configurações > Marca.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Nome da página</Label>
          <TextColorInput value={draft.titleColor} onChange={(titleColor) => onChange({ titleColor })} label="Cor do nome" />
        </div>
        <Input
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="h-11 sm:h-9"
          style={{ color: draft.titleColor }}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Descrição</Label>
          <TextColorInput value={draft.bioColor} onChange={(bioColor) => onChange({ bioColor })} label="Cor da descrição" />
        </div>
        <Textarea
          value={draft.bio}
          onChange={(event) => onChange({ bio: event.target.value })}
          rows={3}
          placeholder="Uma breve descrição..."
          style={{ color: draft.bioColor }}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Cor principal</Label>
        <ColorSwatchPicker
          colors={PRESET_COVER_COLORS}
          value={draft.coverColor}
          onChange={(coverColor) => onChange({ coverColor })}
          label="Cor principal"
        />
        <div className="flex gap-2">
          {BUTTON_STYLES.map((buttonStyle) => (
            <button
              key={buttonStyle.value}
              type="button"
              onClick={() => onChange({ buttonStyle: buttonStyle.value })}
              aria-pressed={draft.buttonStyle === buttonStyle.value}
              className={cn(
                "h-9 flex-1 text-[11px] font-medium text-white transition-all",
                buttonStyle.previewClassName,
                draft.buttonStyle === buttonStyle.value
                  ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                  : "opacity-70 hover:opacity-100",
              )}
              style={{ background: draft.coverColor }}
            >
              {buttonStyle.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Foto de perfil</Label>
        <div className="flex items-start gap-4">
          <LinnkerImageUploader
            value={draft.avatarUrl}
            onChange={(avatarUrl) => onChange({ avatarUrl })}
            aspectRatio="square"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <p className="text-xs text-muted-foreground">Imagem redonda exibida no centro</p>
            <Button type="button" variant="outline" className="h-10 w-full rounded-full text-xs sm:h-9" onClick={applyOrgLogo}>
              Usar logo da empresa
            </Button>
          </div>
        </div>
      </div>

      <LinnkerImageUploader
        value={draft.bannerUrl}
        onChange={(bannerUrl) => onChange({ bannerUrl })}
        label="Banner do topo (imagem horizontal)"
        aspectRatio="banner"
      />
    </div>
  );
}
