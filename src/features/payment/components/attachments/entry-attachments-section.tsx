"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Trash2, FileText, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useEntryAttachments,
  useDeletePaymentAttachment,
  useLinkPaymentAttachments,
  attachmentPreviewUrl,
  attachmentDownloadUrl,
} from "../../hooks/use-payment-attachments";
import { ATTACHMENT_KIND_LABELS, formatFileSize } from "../../lib/attachments";
import { AttachmentUploader } from "./attachment-uploader";

// Anexos de um lançamento que JÁ existe (RF-10). Diferente do form de criação,
// aqui o vínculo acontece na hora do upload — não há submit pendente pra
// esperar, e deixar o arquivo solto viraria documento "Sem vínculo" à toa.

interface EntryAttachmentsSectionProps {
  entryId: string;
}

export function EntryAttachmentsSection({ entryId }: EntryAttachmentsSectionProps) {
  const { data, isLoading } = useEntryAttachments(entryId);
  const linkAttachments = useLinkPaymentAttachments();
  const deleteAttachment = useDeletePaymentAttachment();

  const attachments = data?.attachments ?? [];

  return (
    <div className="space-y-2">
      <Label>Anexos</Label>

      {isLoading ? (
        <div className="h-10 animate-pulse rounded-md bg-muted/40" />
      ) : (
        attachments.length > 0 && (
          <ul className="space-y-1.5">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
              >
                {attachment.mimeType.startsWith("image/") ? (
                  <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={attachment.fileName}>
                    {attachment.fileName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(attachment.sizeBytes)}
                  </p>
                </div>

                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {ATTACHMENT_KIND_LABELS[attachment.kind]}
                </Badge>

                <Button asChild variant="ghost" size="icon" className="size-6 shrink-0" title="Ver">
                  <a
                    href={attachmentPreviewUrl(attachment.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Eye className="size-3.5" />
                  </a>
                </Button>
                <Button asChild variant="ghost" size="icon" className="size-6 shrink-0" title="Baixar">
                  <a href={attachmentDownloadUrl(attachment.id)}>
                    <Download className="size-3.5" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-destructive hover:text-destructive"
                  title="Excluir"
                  onClick={() =>
                    deleteAttachment.mutate(
                      { id: attachment.id },
                      {
                        onSuccess: () => toast.success("Anexo excluído"),
                        onError: () => toast.error("Erro ao excluir o anexo"),
                      },
                    )
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )
      )}

      <AttachmentUploader
        onChange={() => {}}
        onUploaded={(uploaded) =>
          linkAttachments.mutate(
            { attachmentIds: [uploaded.id], entryIds: [entryId] },
            { onError: () => toast.error("Arquivo enviado, mas não vinculou ao lançamento") },
          )
        }
      />
    </div>
  );
}
