"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { LinnkerResourceSelector } from "../linnker-resource-selector";
import { LinnkerImageUploader } from "../linnker-image-uploader";
import { LinnkerSheetDialog } from "../linnker-sheet-dialog";
import { LinnkerLinkColorPicker } from "./linnker-link-color-picker";
import {
  DISPLAY_STYLE_OPTIONS,
  EMPTY_NEW_LINK,
  LINK_EMOJIS,
  LINK_TYPE_OPTIONS,
  TYPE_DEFAULT_EMOJI,
  type NewLinkForm,
} from "./link-form-options";
import type { LinnkerLinkType, LinnkerPage } from "../../types";

interface LinnkerAddLinkDialogProps {
  page: LinnkerPage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefetch: () => void;
}

export function LinnkerAddLinkDialog({ page, open, onOpenChange, onRefetch }: LinnkerAddLinkDialogProps) {
  const [newLink, setNewLink] = useState<NewLinkForm>(EMPTY_NEW_LINK);

  const isExternal = newLink.type === "EXTERNAL";
  const isBanner = newLink.displayStyle === "banner";
  const canSubmit = Boolean(
    newLink.title.trim() && (isExternal ? newLink.url.trim() : newLink.selectedResourceId),
  );

  const updateNewLink = (patch: Partial<NewLinkForm>) =>
    setNewLink((current) => ({ ...current, ...patch }));

  const handleTypeChange = (type: LinnkerLinkType) => {
    updateNewLink({ type, emoji: TYPE_DEFAULT_EMOJI[type], url: "", selectedResourceId: "" });
  };

  const handleResourceSelect = (resource: { id: string; name: string; url: string }) => {
    setNewLink((current) => ({
      ...current,
      selectedResourceId: resource.id,
      url: resource.url,
      title: current.title || resource.name,
    }));
  };

  const { mutate: createLink, isPending: isCreating } = useMutation({
    mutationFn: () =>
      client.linnker.createLink({
        pageId: page.id,
        title: newLink.title,
        url: newLink.url,
        type: newLink.type,
        emoji: newLink.emoji || undefined,
        imageUrl: newLink.imageUrl || undefined,
        displayStyle: newLink.displayStyle,
        color: newLink.color || undefined,
      }),
    onSuccess: async (response) => {
      emitTourResult({ kind: GUIDE_RESULT_KINDS.linnkerLinkCreated });
      const createdLinkId = response?.link?.id;
      // O link de Tracking só ganha o id depois de criado: troca o marcador pela id real.
      if (newLink.type === "TRACKING" && createdLinkId && newLink.url.includes("__LINK__")) {
        await client.linnker.updateLink({
          id: createdLinkId,
          url: newLink.url.replace("__LINK__", createdLinkId),
        });
      }
      toast.success("Link adicionado!");
      setNewLink(EMPTY_NEW_LINK);
      onOpenChange(false);
      onRefetch();
    },
    onError: () => toast.error("Erro ao criar link"),
  });

  return (
    <LinnkerSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Novo link"
      icon={<Plus className="size-4 text-info" />}
      footer={
        <>
          <Button variant="outline" className="rounded-full max-sm:hidden" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="h-12 w-full rounded-full sm:h-9 sm:w-auto"
            onClick={() => createLink()}
            disabled={isCreating || !canSubmit}
            data-guide={GUIDE_ANCHORS.linnkerLinkSubmit.id}
          >
            {isCreating ? "Adicionando..." : "Adicionar link"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Para onde o link leva</Label>
          <Select value={newLink.type} onValueChange={(value) => handleTypeChange(value as LinnkerLinkType)}>
            <SelectTrigger className="h-11 w-full sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINK_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <option.icon className="size-4" />
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Como aparece</Label>
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {DISPLAY_STYLE_OPTIONS.map((option) => {
              const isActive = newLink.displayStyle === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateNewLink({ displayStyle: option.value })}
                  aria-pressed={isActive}
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors",
                    isActive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <option.icon className="size-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {DISPLAY_STYLE_OPTIONS.find((option) => option.value === newLink.displayStyle)?.description}
          </p>
        </div>

        {!isExternal && (
          <LinnkerResourceSelector
            type={newLink.type}
            pageSlug={page.slug}
            selectedId={newLink.selectedResourceId}
            onSelect={handleResourceSelect}
          />
        )}

        <LinnkerImageUploader
          value={newLink.imageUrl}
          onChange={(imageUrl) => updateNewLink({ imageUrl })}
          label={isBanner ? "Imagem do banner *" : "Imagem do ícone (opcional)"}
          aspectRatio={isBanner ? "banner" : "wide"}
        />

        {!isBanner && !newLink.imageUrl && (
          <div className="space-y-1.5">
            <Label className="text-xs">Ou escolha um emoji</Label>
            <div className="flex flex-wrap gap-1">
              {LINK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => updateNewLink({ emoji })}
                  aria-pressed={newLink.emoji === emoji}
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-lg hover:bg-muted",
                    newLink.emoji === emoji && "bg-muted ring-2 ring-foreground",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Título</Label>
          <Input
            placeholder="Ex: Fale conosco"
            value={newLink.title}
            className="h-11 sm:h-9"
            data-guide={GUIDE_ANCHORS.linnkerLinkTitle.id}
            onChange={(event) => updateNewLink({ title: event.target.value })}
          />
        </div>

        <LinnkerLinkColorPicker
          value={newLink.color}
          onChange={(color) => updateNewLink({ color })}
          pageCoverColor={page.coverColor}
        />

        {isExternal && (
          <div className="space-y-1.5">
            <Label className="text-xs">Endereço de destino</Label>
            <Input
              placeholder="https://..."
              value={newLink.url}
              inputMode="url"
              className="h-11 sm:h-9"
              data-guide={GUIDE_ANCHORS.linnkerLinkUrl.id}
              onChange={(event) => updateNewLink({ url: event.target.value })}
            />
          </div>
        )}

        {!isExternal && newLink.url && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Endereço gerado automaticamente</Label>
            <p className="rounded-[14px] bg-muted px-3 py-2 font-mono text-xs break-all text-muted-foreground">
              {newLink.url}
            </p>
          </div>
        )}
      </div>
    </LinnkerSheetDialog>
  );
}
