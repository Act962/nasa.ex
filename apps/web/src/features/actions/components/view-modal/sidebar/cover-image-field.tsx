"use client";

import { ImageIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarField } from "./sidebar-field";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useState, useEffect } from "react";

interface Props {
  coverImage: string | null;
  onUpdate: (url: string | null) => void;
  disabled?: boolean;
}

export function CoverImageField({ coverImage, onUpdate, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [localKey, setLocalKey] = useState<string | null>(coverImage);
  
  // Synchronize local state with the prop when it changes externally
  useEffect(() => {
    setLocalKey(coverImage);
  }, [coverImage]);

  // Use localKey for immediate UI feedback before the parent state updates
  const imageUrl = useConstructUrl(localKey || "");

  const handleUpdate = (newKey: string | null) => {
    const normalizedKey = newKey || null;
    setLocalKey(normalizedKey);
    onUpdate(normalizedKey);
    setEditing(false);
  };

  return (
    <SidebarField label="Imagem de Capa" icon={<ImageIcon className="size-3.5" />}>
      {editing ? (
        <div className="space-y-2">
          <Uploader
            value={localKey || ""}
            onConfirm={(key) => handleUpdate(key || null)}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => {
              setEditing(false);
              setLocalKey(coverImage); // Reset local state on cancel
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : (localKey && imageUrl) ? (
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
                onClick={() => handleUpdate(null)}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          )}
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
