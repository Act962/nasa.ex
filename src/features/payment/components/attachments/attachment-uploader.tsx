"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, RotateCcw, Loader2, FileText, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useUploadPaymentAttachment,
  useDeletePaymentAttachment,
  type UploadedAttachment,
} from "../../hooks/use-payment-attachments";
import {
  ACCEPT_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_KIND_LABELS,
  isAllowedAttachmentType,
  formatFileSize,
} from "../../lib/attachments";
import { cn } from "@/lib/utils";

// Cada arquivo escolhido vira um slot com estado próprio: o upload de um não
// derruba os outros, e um erro é recuperável sem refazer o form (CB-2).
interface AttachmentSlot {
  localId: string;
  file: File;
  status: "uploading" | "done" | "error";
  uploaded?: UploadedAttachment;
  errorMessage?: string;
}

interface AttachmentUploaderProps {
  /** Ids já enviados — o pai usa isso pra vincular ao salvar o lançamento. */
  onChange: (attachmentIds: string[]) => void;
  /**
   * Disparado uma vez por arquivo que sobe com sucesso. Quem edita lançamento
   * já existente usa isso pra vincular na hora, sem esperar submit.
   */
  onUploaded?: (attachment: UploadedAttachment) => void;
  disabled?: boolean;
}

let slotCounter = 0;

export function AttachmentUploader({
  onChange,
  onUploaded,
  disabled,
}: AttachmentUploaderProps) {
  const [slots, setSlots] = useState<AttachmentSlot[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadAttachment = useUploadPaymentAttachment();
  const deleteAttachment = useDeletePaymentAttachment();

  function publishIds(nextSlots: AttachmentSlot[]) {
    onChange(
      nextSlots
        .filter((slot) => slot.status === "done" && slot.uploaded)
        .map((slot) => slot.uploaded!.id),
    );
  }

  function updateSlot(localId: string, patch: Partial<AttachmentSlot>) {
    setSlots((current) => {
      const next = current.map((slot) =>
        slot.localId === localId ? { ...slot, ...patch } : slot,
      );
      publishIds(next);
      return next;
    });
  }

  async function startUpload(slot: AttachmentSlot) {
    try {
      const uploaded = await uploadAttachment.mutateAsync(slot.file);
      updateSlot(slot.localId, { status: "done", uploaded, errorMessage: undefined });
      onUploaded?.(uploaded);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio";
      updateSlot(slot.localId, { status: "error", errorMessage: message });
      toast.error(message);
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const accepted: AttachmentSlot[] = [];

    for (const file of Array.from(fileList)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(
          `"${file.name}" tem ${formatFileSize(file.size)}. O limite é ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`,
        );
        continue;
      }
      if (!isAllowedAttachmentType(file.type)) {
        toast.error(`"${file.name}": formato não suportado.`);
        continue;
      }
      accepted.push({
        localId: `slot-${++slotCounter}`,
        file,
        status: "uploading",
      });
    }

    if (accepted.length === 0) return;

    setSlots((current) => [...current, ...accepted]);
    accepted.forEach(startUpload);
  }

  async function removeSlot(slot: AttachmentSlot) {
    // Já subiu: apaga do acervo pra não deixar documento fantasma. Ainda
    // subindo ou com erro: só some da tela.
    if (slot.status === "done" && slot.uploaded) {
      try {
        await deleteAttachment.mutateAsync({ id: slot.uploaded.id });
      } catch {
        toast.error("Não foi possível remover o arquivo do acervo.");
        return;
      }
    }
    setSlots((current) => {
      const next = current.filter((item) => item.localId !== slot.localId);
      publishIds(next);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          if (!disabled) addFiles(event.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center transition-colors",
          isDraggingOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/40",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Paperclip className="size-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Arraste nota fiscal, boleto ou comprovante — ou{" "}
          <span className="text-primary underline underline-offset-2">escolha do computador</span>
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          PDF, imagem, XML, planilha ou documento — até {formatFileSize(MAX_ATTACHMENT_BYTES)}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTACHMENT_TYPES}
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {slots.length > 0 && (
        <ul className="space-y-1.5">
          {slots.map((slot) => (
            <li
              key={slot.localId}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
                slot.status === "error" && "border-destructive/40 bg-destructive/5",
              )}
            >
              {slot.status === "uploading" ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : slot.file.type.startsWith("image/") ? (
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{slot.file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {slot.status === "error"
                    ? (slot.errorMessage ?? "Falha no envio")
                    : slot.status === "uploading"
                      ? "Enviando…"
                      : `${formatFileSize(slot.file.size)} · ${ATTACHMENT_KIND_LABELS[slot.uploaded?.kind ?? "OUTRO"]}`}
                </p>
              </div>

              {slot.status === "error" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  title="Tentar de novo"
                  onClick={() => {
                    updateSlot(slot.localId, { status: "uploading", errorMessage: undefined });
                    startUpload(slot);
                  }}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                title="Remover"
                onClick={() => removeSlot(slot)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
