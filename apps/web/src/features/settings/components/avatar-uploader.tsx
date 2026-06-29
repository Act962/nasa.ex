"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, X, Check } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSpacePointCtx } from "@/features/space-point/components/space-point-provider";

const MAX_SIZE_MB = 5;
const ACCEPTED    = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function AvatarUploader() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const { earn } = useSpacePointCtx();

  const inputRef               = useRef<HTMLInputElement>(null);
  const [preview, setPreview]  = useState<string | null>(null);
  const [file, setFile]        = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const currentImage = session?.user?.image ?? null;
  const name         = session?.user?.name ?? "";
  const initials     = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ACCEPTED.includes(selected.type)) {
      toast.error("Formato inválido. Use JPG, PNG, WebP ou GIF.");
      return;
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  // ── Cancel preview ──────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
  };

  // ── Upload & save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!file) return;
    setUploading(true);

    try {
      // 1. Get presigned URL from S3
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename:    file.name,
          contentType: file.type,
          size:        file.size,
          isImage:     true,
        }),
      });

      if (!res.ok) throw new Error("Falha ao gerar URL de upload.");
      const { presignedUrl, key } = await res.json();

      // 2. PUT file to S3
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Falha ao enviar arquivo.");

      // 3. Build public URL
      const publicUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;

      // 4. Update user profile via better-auth
      const { error } = await authClient.updateUser({ image: publicUrl });
      if (error) throw new Error(error.message);

      if (name && publicUrl) {
        earn("profile_completed", "Perfil completo (foto + informações) ✨");
      }

      toast.success("Foto de perfil atualizada!");
      handleCancel();
      // Session will refresh automatically via better-auth broadcast
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar foto.");
    } finally {
      setUploading(false);
    }
  };

  const displaySrc = preview ?? currentImage;

  return (
    <div className="flex items-center gap-5">
      {/* ── Avatar circle ── */}
      <div className="relative group shrink-0">
        <div
          className={cn(
            "relative w-20 h-20 rounded-full overflow-hidden cursor-pointer ring-2 ring-border transition-all",
            "group-hover:ring-primary group-hover:ring-offset-2 group-hover:ring-offset-background",
            preview && "ring-primary",
          )}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          {isPending ? (
            <div className="w-full h-full bg-muted animate-pulse" />
          ) : displaySrc ? (
            <Image src={displaySrc} alt={name} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center text-primary-foreground text-2xl font-bold select-none">
              {initials}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      {/* ── Info + actions ── */}
      <div className="flex flex-col gap-1.5">
        <div>
          <p className="text-sm font-medium">Foto de perfil</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF · máx. {MAX_SIZE_MB}MB</p>
        </div>

        {!preview ? (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading || isPending}
            className="w-fit text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentImage ? "Alterar foto" : "Adicionar foto"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {/* Confirm */}
            <button
              onClick={handleSave}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {uploading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
              ) : (
                <><Check className="w-3 h-3" /> Salvar</>
              )}
            </button>

            {/* Cancel */}
            {!uploading && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-all"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
