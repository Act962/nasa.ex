"use client";

import { useCallback, useState } from "react";
import { useUploadPaymentAttachment } from "@/features/payment/hooks/use-payment-attachments";
import {
  isAllowedAttachmentType,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
} from "@/features/payment/lib/attachments";
import type { AstroAttachmentData } from "@/features/astro/schemas/chat-message";

/**
 * Anexos do chat do Astro (spec 0014, D-3): o arquivo sobe primeiro por
 * `/api/payment/attachments/upload` e vira `PaymentAttachment` sem vínculo;
 * a mensagem leva só a referência. Se o usuário desistir, o arquivo aparece
 * em Documentos como "Sem vínculo" em vez de virar órfão.
 */
export interface PendingAstroAttachment extends Partial<AstroAttachmentData> {
  localId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploading: boolean;
  error?: string;
}

export function useAstroAttachments() {
  const [attachments, setAttachments] = useState<PendingAstroAttachment[]>([]);
  const uploadMutation = useUploadPaymentAttachment();

  const addFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const localId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        if (file.size > MAX_ATTACHMENT_BYTES) {
          setAttachments((current) => [
            ...current,
            {
              localId,
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              uploading: false,
              error: `Arquivo muito grande (${formatFileSize(file.size)}). Limite: ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`,
            },
          ]);
          continue;
        }
        if (!isAllowedAttachmentType(file.type)) {
          setAttachments((current) => [
            ...current,
            {
              localId,
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              uploading: false,
              error: `Formato não suportado: ${file.type || "desconhecido"}.`,
            },
          ]);
          continue;
        }

        setAttachments((current) => [
          ...current,
          {
            localId,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            uploading: true,
          },
        ]);

        try {
          const uploaded = await uploadMutation.mutateAsync(file);
          setAttachments((current) =>
            current.map((attachment) =>
              attachment.localId === localId
                ? {
                    ...attachment,
                    attachmentId: uploaded.id,
                    fileName: uploaded.fileName,
                    mimeType: uploaded.mimeType,
                    sizeBytes: uploaded.sizeBytes,
                    uploading: false,
                  }
                : attachment,
            ),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao enviar o arquivo";
          setAttachments((current) =>
            current.map((attachment) =>
              attachment.localId === localId
                ? { ...attachment, uploading: false, error: message }
                : attachment,
            ),
          );
        }
      }
    },
    [uploadMutation],
  );

  const removeAttachment = useCallback((localId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.localId !== localId));
  }, []);

  const clearAttachments = useCallback(() => setAttachments([]), []);

  /** Só os que subiram de verdade viram data part da mensagem. */
  const readyAttachments: AstroAttachmentData[] = attachments
    .filter((attachment): attachment is PendingAstroAttachment & { attachmentId: string } =>
      Boolean(attachment.attachmentId),
    )
    .map((attachment) => ({
      attachmentId: attachment.attachmentId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    }));

  return {
    attachments,
    readyAttachments,
    isUploading: attachments.some((attachment) => attachment.uploading),
    addFiles,
    removeAttachment,
    clearAttachments,
  };
}
