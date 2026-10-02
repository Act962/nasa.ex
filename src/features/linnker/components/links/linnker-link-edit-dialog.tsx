"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { LinnkerResourceSelector } from "../linnker-resource-selector";
import { LinnkerImageUploader } from "../linnker-image-uploader";
import { LinnkerSheetDialog } from "../linnker-sheet-dialog";
import { LinnkerLinkColorPicker } from "./linnker-link-color-picker";
import type { LinnkerLink } from "../../types";

interface LinnkerLinkEditDialogProps {
  link: LinnkerLink;
  pageSlug: string;
  pageCoverColor: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefetch: () => void;
}

export function LinnkerLinkEditDialog({
  link,
  pageSlug,
  pageCoverColor,
  open,
  onOpenChange,
  onRefetch,
}: LinnkerLinkEditDialogProps) {
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [imageUrl, setImageUrl] = useState<string | null>(link.imageUrl ?? null);
  const [color, setColor] = useState<string | null>(link.color ?? null);
  const [selectedResourceId, setSelectedResourceId] = useState("");

  const isExternal = link.type === "EXTERNAL";
  const isBanner = link.displayStyle === "banner";

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      client.linnker.updateLink({ id: link.id, title, url, imageUrl, color }),
    onSuccess: () => {
      toast.success("Salvo!");
      onOpenChange(false);
      onRefetch();
    },
    onError: () => toast.error("Erro ao salvar link"),
  });

  return (
    <LinnkerSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar link"
      icon={<Pencil className="size-4 text-info" />}
      footer={
        <>
          <Button variant="outline" className="rounded-full max-sm:hidden" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-12 w-full rounded-full sm:h-9 sm:w-auto" onClick={() => save()} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Título</Label>
          <Input value={title} className="h-11 sm:h-9" onChange={(event) => setTitle(event.target.value)} />
        </div>

        <LinnkerLinkColorPicker value={color} onChange={setColor} pageCoverColor={pageCoverColor} />

        <LinnkerImageUploader
          value={imageUrl}
          onChange={setImageUrl}
          label={isBanner ? "Imagem do banner" : "Imagem do ícone (opcional)"}
          aspectRatio={isBanner ? "banner" : "wide"}
        />

        {!isExternal && (
          <LinnkerResourceSelector
            type={link.type}
            pageSlug={pageSlug}
            selectedId={selectedResourceId}
            onSelect={(resource) => {
              setSelectedResourceId(resource.id);
              setUrl(resource.url);
            }}
          />
        )}

        {isExternal && (
          <div className="space-y-1.5">
            <Label className="text-xs">Endereço de destino</Label>
            <Input value={url} inputMode="url" className="h-11 sm:h-9" onChange={(event) => setUrl(event.target.value)} />
          </div>
        )}

        {!isExternal && url && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Endereço gerado</Label>
            <p className="rounded-[14px] bg-muted px-3 py-2 font-mono text-xs break-all text-muted-foreground">{url}</p>
          </div>
        )}
      </div>
    </LinnkerSheetDialog>
  );
}
