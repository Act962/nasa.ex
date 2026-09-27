"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AstroMark } from "@/features/astro/components/astro-mark";

/** Ícone do widget no site do cliente (spec 0031, RF-15). */

const MAX_SIZE_MB = 2;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export function WidgetAvatarUploader({
  value,
  accentColor,
  onChange,
}: {
  value: string | null;
  accentColor: string;
  onChange: (avatarUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Use PNG, JPG, WebP ou SVG.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande. Máximo ${MAX_SIZE_MB} MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const signed = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      if (!signed.ok) throw new Error("Não consegui preparar o envio.");
      const { presignedUrl, key } = await signed.json();

      const uploaded = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploaded.ok) throw new Error("Não consegui enviar a imagem.");

      onChange(`https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`);
      toast.success("Ícone atualizado. Salve para valer no site.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar a imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <span
        className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full"
        style={{ backgroundColor: `${accentColor}1a` }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do cliente, fora do otimizador
          <img src={value} alt="Ícone do widget" className="size-full object-cover" />
        ) : (
          <AstroMark className="size-10" />
        )}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {value ? "Trocar ícone" : "Enviar ícone"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-4" />
            Usar o ASTRO
          </Button>
        )}
      </div>
    </div>
  );
}
