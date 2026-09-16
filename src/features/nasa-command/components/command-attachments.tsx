"use client";

import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { AstroAttachmentChip } from "@/features/astro/components/astro-attachment-chip";
import type { PendingAstroAttachment } from "@/features/astro/hooks/use-astro-attachments";
import { ACCEPT_ATTACHMENT_TYPES } from "@/features/payment/lib/attachments";

// Anexos do input do /home: a fila de arquivos que vai junto da próxima
// mensagem ao Astro e o botão de clipe que abre o seletor.

export function CommandAttachmentList({
  attachments,
  onRemoveAttachment,
}: {
  attachments: PendingAstroAttachment[];
  onRemoveAttachment?: (localId: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-3">
      {attachments.map((attachment) => (
        <AstroAttachmentChip
          key={attachment.localId}
          fileName={attachment.fileName}
          mimeType={attachment.mimeType}
          sizeBytes={attachment.sizeBytes}
          uploading={attachment.uploading}
          onRemove={
            onRemoveAttachment ? () => onRemoveAttachment(attachment.localId) : undefined
          }
          className={attachment.error ? "border-rose-500/50 text-rose-300" : undefined}
        />
      ))}
    </div>
  );
}

export function CommandAttachButton({
  onAddFiles,
  disabled,
}: {
  onAddFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTACHMENT_TYPES}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onAddFiles(files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Anexar boleto, nota fiscal ou comprovante"
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
      >
        <Paperclip className="w-3.5 h-3.5" />
      </button>
    </>
  );
}
