"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SIZE_MB = 5;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspectRatio?: "square" | "banner" | "wide";
  className?: string;
}

export function LinnkerImageUploader({
  value,
  onChange,
  label,
  aspectRatio = "banner",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [uploading, setUploading] = useState(false);

  const heights: Record<string, string> = {
    square: "h-24 w-24 rounded-full",
    banner: "h-28 w-full rounded-xl",
    wide: "h-20 w-full rounded-xl",
  };

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG, WebP, GIF ou SVG.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });

      if (!res.ok) throw new Error("Falha ao gerar URL de upload.");
      const { presignedUrl, key } = await res.json();

      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Falha ao enviar arquivo.");

      const publicUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
      setPreview(publicUrl);
      onChange(publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar imagem.");
      setPreview(value ?? null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      <div
        className={cn(
          "relative overflow-hidden border-2 border-dashed border-border transition-colors cursor-pointer group bg-muted/30 hover:border-primary flex items-center justify-center",
          heights[aspectRatio],
        )}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
          disabled={uploading}
        />

        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <Loader2 className="size-5 text-white animate-spin" />
          </div>
        )}

        {preview ? (
          <>
            <img
              src={preview}
              alt="Preview"
              className={cn(
                "object-cover w-full h-full",
                aspectRatio === "square" ? "rounded-full" : "",
              )}
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
              <span className="text-white text-xs font-medium flex items-center gap-1">
                <Upload className="size-3.5" /> Trocar
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <ImageIcon className="size-6" />
            <span className="text-xs">Clique ou arraste uma imagem</span>
            <span className="text-[10px]">JPG, PNG, WebP · máx. {MAX_SIZE_MB}MB</span>
          </div>
        )}
      </div>

      {preview && !uploading && (
        <button
          type="button"
          onClick={handleRemove}
          className="flex items-center gap-1 text-xs text-destructive hover:underline"
        >
          <X className="size-3" /> Remover imagem
        </button>
      )}
    </div>
  );
}
