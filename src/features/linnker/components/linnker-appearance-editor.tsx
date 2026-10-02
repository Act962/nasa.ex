"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Palette, Share2, User, ImageIcon, QrCode, IdCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinnkerPage } from "../types";
import {
  buildAppearanceDraft,
  toPreviewOverride,
  toVcardOverrides,
  type AppearanceDraft,
} from "./appearance/appearance-draft";
import { AppearanceProfileSection } from "./appearance/appearance-profile-section";
import { AppearanceColorsSection } from "./appearance/appearance-colors-section";
import { AppearanceBackgroundSection } from "./appearance/appearance-background-section";
import { AppearanceSocialSection } from "./appearance/appearance-social-section";
import { AppearanceVcardSection } from "./appearance/appearance-vcard-section";
import { AppearanceQrSection } from "./appearance/appearance-qr-section";

type AppearanceSectionKey = "profile" | "colors" | "background" | "social" | "vcard" | "qr";

const APPEARANCE_SECTIONS = [
  { key: "profile", label: "Perfil", icon: User },
  { key: "colors", label: "Cores", icon: Palette },
  { key: "background", label: "Fundo", icon: ImageIcon },
  { key: "social", label: "Social", icon: Share2 },
  { key: "vcard", label: "Cartão", icon: IdCard },
  { key: "qr", label: "QR", icon: QrCode },
] as const satisfies readonly { key: AppearanceSectionKey; label: string; icon: unknown }[];

interface Props {
  page: LinnkerPage;
  onRefetch: () => void;
  onPreviewChange?: (partial: Partial<LinnkerPage>) => void;
  /** Recebe a função de salvar, usada pelo botão central do menu de baixo no celular. */
  saveActionRef?: MutableRefObject<(() => void) | null>;
}

export function LinnkerAppearanceEditor({ page, onRefetch, onPreviewChange, saveActionRef }: Props) {
  const [draft, setDraft] = useState<AppearanceDraft>(() => buildAppearanceDraft(page));
  const [draftPageId, setDraftPageId] = useState(page.id);
  const [activeSection, setActiveSection] = useState<AppearanceSectionKey>("profile");

  // Trocar de página recomeça o rascunho; salvar e recarregar a mesma página não apaga o que está sendo editado.
  if (draftPageId !== page.id) {
    setDraftPageId(page.id);
    setDraft(buildAppearanceDraft(page));
  }

  const updateDraft = (patch: Partial<AppearanceDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  useEffect(() => {
    onPreviewChange?.(toPreviewOverride(draft));
  }, [draft, onPreviewChange]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      const filledSocialLinks = draft.socialLinks.filter((socialLink) => socialLink.url.trim());
      return client.linnker.updatePage({
        id: page.id,
        title: draft.title,
        bio: draft.bio,
        coverColor: draft.coverColor,
        buttonStyle: draft.buttonStyle,
        avatarUrl: draft.avatarUrl,
        bannerUrl: draft.bannerUrl,
        backgroundColor: draft.backgroundColor,
        backgroundImage: draft.backgroundImage,
        backgroundOpacity: draft.backgroundOpacity,
        socialIconColor: draft.socialIconColor,
        titleColor: draft.titleColor,
        bioColor: draft.bioColor,
        qrEnabled: draft.qrEnabled,
        qrMessageTemplate: draft.qrMessageTemplate.trim() || null,
        vcardOverrides: toVcardOverrides(draft.vcard),
        socialLinks: filledSocialLinks.length > 0 ? filledSocialLinks : null,
      });
    },
    onSuccess: () => { toast.success("Aparência atualizada!"); onRefetch(); },
    onError: () => toast.error("Erro ao salvar"),
  });

  useEffect(() => {
    if (!saveActionRef) return;
    saveActionRef.current = () => save();
    return () => {
      saveActionRef.current = null;
    };
  }, [saveActionRef, save]);

  return (
    <div className="space-y-5">
      <div className="scroll-hidden-x -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max min-w-full gap-1 rounded-full bg-panel p-1">
          {APPEARANCE_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              aria-pressed={activeSection === section.key}
              className={cn(
                "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-medium whitespace-nowrap transition-colors",
                activeSection === section.key
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <section.icon className="size-3.5" />
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "profile" && <AppearanceProfileSection draft={draft} onChange={updateDraft} />}
      {activeSection === "colors" && <AppearanceColorsSection draft={draft} onChange={updateDraft} />}
      {activeSection === "background" && <AppearanceBackgroundSection draft={draft} onChange={updateDraft} />}
      {activeSection === "social" && <AppearanceSocialSection draft={draft} onChange={updateDraft} />}
      {activeSection === "vcard" && (
        <AppearanceVcardSection draft={draft} onChange={updateDraft} pageTitle={page.title} pageSlug={page.slug} />
      )}
      {activeSection === "qr" && <AppearanceQrSection draft={draft} onChange={updateDraft} />}

      <Button onClick={() => save()} disabled={isPending} className="h-12 w-full rounded-full md:h-10">
        {isPending ? "Salvando..." : "Salvar aparência"}
      </Button>
    </div>
  );
}
