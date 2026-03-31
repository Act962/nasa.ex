"use client";

import { ImageIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarField } from "./sidebar-field";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useState } from "react";

interface Props {
  coverImage: string | null;
  onUpdate: (url: string | null) => void;
  disabled?: boolean;
}

export function CoverImageField({ coverImage, onUpdate, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const imageUrl = useConstructUrl(coverImage || "");

  return (
    <SidebarField label="Imagem de Capa" icon={<ImageIcon className="size-3.5" />}>
      {coverImage && imageUrl ? (
        <div className="relative rounded-md overflow-hidden group">
          <img
            src={imageUrl}
            alt="Capa"
            className="w-full h-20 object-cover rounded-md"
          />
          {!disabled && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-6 text-xs px-2"
                onClick={() => setEditing(true)}
              >
                Alterar
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="size-6"
                onClick={() => onUpdate(null)}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          )}
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <Uploader
            value=""
            onConfirm={(url) => {
              onUpdate(url || null);
              setEditing(false);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-dashed w-full"
          onClick={() => setEditing(true)}
          disabled={disabled}
        >
          <ImageIcon className="size-3" />
          Adicionar imagem de capa
        </Button>
      )}
    </SidebarField>
  );
}
