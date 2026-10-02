"use client";

import { FileTextIcon, ImageIcon, XIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/features/payment/lib/attachments";

/**
 * Chip de arquivo anexado — usado no composer (antes de enviar) e dentro da
 * mensagem já enviada (spec 0014, D-3).
 */
export function AstroAttachmentChip({
  fileName,
  mimeType,
  sizeBytes,
  uploading,
  onRemove,
  className,
}: {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  uploading?: boolean;
  onRemove?: () => void;
  className?: string;
}) {
  const isImage = mimeType?.startsWith("image/");
  return (
    <span
      className={cn(
        "inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-line/70 bg-card/60 px-2 py-1 text-[11px] text-foreground",
        className,
      )}
    >
      {uploading ? (
        <OrbitaSpinner className="size-3.5 shrink-0 text-info" />
      ) : isImage ? (
        <ImageIcon className="size-3.5 shrink-0 text-info" />
      ) : (
        <FileTextIcon className="size-3.5 shrink-0 text-info" />
      )}
      <span className="truncate" title={fileName}>
        {fileName}
      </span>
      {typeof sizeBytes === "number" && !uploading && (
        <span className="shrink-0 text-muted-foreground">{formatFileSize(sizeBytes)}</span>
      )}
      {onRemove && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${fileName}`}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-knob hover:text-foreground"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}
