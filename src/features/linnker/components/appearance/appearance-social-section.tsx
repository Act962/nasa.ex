"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { SOCIAL_PLATFORMS, type SocialLink } from "../../types";
import { ColorSwatchPicker } from "./color-swatch-picker";
import { SocialIcon } from "./social-icon";
import { PRESET_SOCIAL_ICON_COLORS } from "./appearance-options";
import type { AppearanceDraft, UpdateAppearanceDraft } from "./appearance-draft";

const MAX_SOCIAL_LINKS = 8;

interface AppearanceSectionProps {
  draft: AppearanceDraft;
  onChange: UpdateAppearanceDraft;
}

export function AppearanceSocialSection({ draft, onChange }: AppearanceSectionProps) {
  const { socialLinks, socialIconColor } = draft;
  const filledSocialLinks = socialLinks.filter((socialLink) => socialLink.url.trim());

  const addSocialLink = () =>
    onChange({ socialLinks: [...socialLinks, { platform: "instagram", url: "" }] });
  const removeSocialLink = (removedIndex: number) =>
    onChange({ socialLinks: socialLinks.filter((_, index) => index !== removedIndex) });
  const updateSocialLink = (updatedIndex: number, field: keyof SocialLink, value: string) =>
    onChange({
      socialLinks: socialLinks.map((socialLink, index) =>
        index === updatedIndex ? { ...socialLink, [field]: value } : socialLink,
      ),
    });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Ícones exibidos no rodapé da página pública.</p>

      <div className="space-y-2">
        <Label className="text-xs">Cor dos ícones</Label>
        <ColorSwatchPicker
          colors={PRESET_SOCIAL_ICON_COLORS}
          value={socialIconColor}
          onChange={(color) => onChange({ socialIconColor: color })}
          label="Cor dos ícones"
        />
        {filledSocialLinks.length > 0 && (
          <div className="flex flex-wrap gap-4 rounded-[18px] bg-muted/30 px-3 py-2">
            {filledSocialLinks.map((socialLink, index) => (
              <SocialIcon key={`${socialLink.platform}-${index}`} platform={socialLink.platform} color={socialIconColor} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {socialLinks.map((socialLink, index) => (
          <div key={index} className="flex items-center gap-2 rounded-[18px] border border-line bg-muted/20 p-3">
            <SocialIcon platform={socialLink.platform} color={socialIconColor} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Select value={socialLink.platform} onValueChange={(platform) => updateSocialLink(index, "platform", platform)}>
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <SelectItem key={platform.key} value={platform.key}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={SOCIAL_PLATFORMS.find((platform) => platform.key === socialLink.platform)?.placeholder ?? "https://..."}
                value={socialLink.url}
                onChange={(event) => updateSocialLink(index, "url", event.target.value)}
                inputMode="url"
                className="h-9 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-full text-destructive hover:text-destructive"
              onClick={() => removeSocialLink(index)}
              aria-label="Remover rede social"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {socialLinks.length < MAX_SOCIAL_LINKS && (
        <Button type="button" variant="outline" className="h-11 w-full rounded-full border-dashed md:h-9" onClick={addSocialLink}>
          <Plus className="size-4" /> Adicionar rede social
        </Button>
      )}
    </div>
  );
}
