"use client";

import { useRef } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_AVATAR_TYPES,
  MAX_AVATAR_SIZE_MB,
  fileToBase64,
  toInitials,
} from "../../utils/profile-utils";

interface ProfileAvatarPickerProps {
  name: string;
  image: string | null;
  isLoading: boolean;
  isSaving: boolean;
  onImageSelected: (base64Image: string) => void;
}

export function ProfileAvatarPicker({
  name,
  image,
  isLoading,
  isSaving,
  onImageSelected,
}: ProfileAvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande. Máximo ${MAX_AVATAR_SIZE_MB}MB.`);
      return;
    }

    try {
      onImageSelected(await fileToBase64(file));
    } catch {
      toast.error("Erro ao ler imagem.");
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Trocar foto de perfil"
        className={cn(
          "group relative size-20 overflow-hidden rounded-full ring-2 ring-border transition-all hover:ring-primary",
          isSaving && "pointer-events-none opacity-60",
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        {isLoading ? (
          <div className="size-full animate-pulse bg-muted" />
        ) : image ? (
          <Image src={image} alt={name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/80 to-primary/40 text-2xl font-bold text-primary-foreground select-none">
            {toInitials(name)}
          </div>
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 transition-opacity group-hover:opacity-100",
            isSaving && "opacity-100",
          )}
        >
          {isSaving ? (
            <OrbitaSpinner className="size-5" isOnBrandColor />
          ) : (
            <Camera className="size-5 text-background" />
          )}
        </span>
        {!isLoading && !isSaving && (
          <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-full bg-background shadow-sm sm:hidden">
            <Camera className="size-3.5" />
          </span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
        disabled={isSaving}
      />
    </>
  );
}
