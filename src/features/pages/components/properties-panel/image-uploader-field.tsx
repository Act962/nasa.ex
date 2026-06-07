"use client";

/**
 * Campo de upload de imagem reusável — abstrai o padrão usado pelo
 * LogoUploader / ImageProps / HeroImageUploader.
 *
 * Usa o helper `uploadImage` (lib/upload-image) que tenta R2 server-side
 * primeiro (funciona em prod) e cai pro `/api/upload-local` em dev.
 *
 * Características:
 *   - Botão de upload (file picker)
 *   - Preview da imagem atual
 *   - Botão pra remover
 *   - Input de URL alternativo (pra colar link externo)
 *   - Toast de sucesso/erro via sonner
 */
import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImage } from "../../lib/upload-image";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  /** Texto do botão upload quando vazio. Default "Fazer upload". */
  uploadLabel?: string;
  /** Altura do preview em px. Default 64. */
  previewHeight?: number;
  /** Mostra ou não o input de URL alternativo. Default true. */
  showUrlField?: boolean;
  /** Aceita tipos de arquivo. Default "image/*,.svg". */
  accept?: string;
}

export function ImageUploaderField({
  value,
  onChange,
  label,
  uploadLabel = "Fazer upload",
  previewHeight = 64,
  showUrlField = true,
  accept = "image/*,.svg",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
      toast.success("Imagem carregada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {label && (
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
      )}
      <div className="flex gap-2 mt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading
            ? "Carregando…"
            : value
              ? "Trocar imagem"
              : uploadLabel}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            // Reseta o input pra permitir upload do MESMO arquivo de novo.
            if (e.target) e.target.value = "";
          }}
        />
        {value && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => onChange("")}
            title="Remover imagem"
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        )}
      </div>

      {value && (
        <div
          className="mt-2 rounded-md border bg-muted/30 p-2 flex items-center justify-center"
          style={{ height: previewHeight }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}

      {showUrlField && (
        <>
          <Label className="text-[10px] text-muted-foreground mt-2">
            ou cole a URL diretamente
          </Label>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            className="text-[10px] font-mono mt-0.5"
          />
        </>
      )}
    </>
  );
}
