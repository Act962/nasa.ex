"use client";

import { cn } from "@/lib/utils";
import { UploadIcon } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

interface CompanyLogoDropzoneProps {
  logoUrl?: string;
  onLogoChange: (logoDataUrl: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CompanyLogoDropzone({
  logoUrl,
  onLogoChange,
  disabled = false,
  className,
}: CompanyLogoDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => onLogoChange(reader.result as string);
      reader.readAsDataURL(file);
    },
    [onLogoChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: () => toast.error("Use uma imagem de até 2 MB."),
    accept: { "image/*": [] },
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_LOGO_SIZE_BYTES,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      aria-label={logoUrl ? "Trocar logo" : "Enviar logo"}
      className={cn(
        "relative size-24 shrink-0 overflow-hidden rounded-full border border-dashed transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        !disabled && isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/20",
        className,
      )}
    >
      <input {...getInputProps()} />
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo da empresa" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <UploadIcon className="size-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
