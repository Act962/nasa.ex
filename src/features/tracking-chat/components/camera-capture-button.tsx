"use client";

import { useRef } from "react";
import { CameraIcon } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { uploadFileToStorage } from "@/lib/upload-to-storage";
import { ComposerActionButton } from "./composer-action-button";

interface CameraCaptureButtonProps {
  isUploading: boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  onCaptured: (fileKey: string) => void;
}

/** Abre a câmera do aparelho (`capture`); no desktop, sem câmera para abrir, cai no seletor de arquivo. */
export function CameraCaptureButton({ isUploading, onUploadStart, onUploadEnd, onCaptured }: CameraCaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (file: File | undefined) => {
    if (!file) return;
    onUploadStart();
    try {
      const fileKey = await uploadFileToStorage(file, { isImage: true });
      onCaptured(fileKey);
    } catch {
      toast.error("Não foi possível enviar a foto. Tente de novo.");
      onUploadEnd();
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <ComposerActionButton
        label="Câmera"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? <Spinner className="size-4" /> : <CameraIcon />}
      </ComposerActionButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => handleCapture(event.target.files?.[0])}
      />
    </>
  );
}
