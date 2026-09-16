"use client";

import { FileTextIcon, ImageIcon, Loader2Icon, XIcon } from "lucide-react";
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
        "inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-zinc-700/70 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-200",
        className,
      )}
    >
      {uploading ? (
        <Loader2Icon className="size-3.5 shrink-0 animate-spin text-violet-400" />
      ) : isImage ? (
        <ImageIcon className="size-3.5 shrink-0 text-violet-400" />
      ) : (
        <FileTextIcon className="size-3.5 shrink-0 text-violet-400" />
      )}
      <span className="truncate" title={fileName}>
        {fileName}
      </span>
      {typeof sizeBytes === "number" && !uploading && (
        <span className="shrink-0 text-zinc-500">{formatFileSize(sizeBytes)}</span>
      )}
      {onRemove && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${fileName}`}
          className="shrink-0 rounded p-0.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-200"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}
