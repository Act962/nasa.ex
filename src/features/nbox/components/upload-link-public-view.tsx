"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { CheckCircle2Icon, ClockIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NBOX_MAX_FILE_BYTES } from "../lib/storage-limits";
import {
  useDeletePublicNboxUpload,
  usePublicNboxUpload,
  usePublicNboxUploadLink,
  useUploaderToken,
} from "../hooks/use-nbox-upload-links";
import { FileTypeIcon, formatBytes } from "./nbox-file-type-icon";
import { UploadProgressText } from "./nbox-modals";

// Página pública do link de envio (spec 0149): o cliente, sem conta, envia arquivos para uma pasta do Nbox.

interface UploadLinkPublicViewProps {
  uploadToken: string;
  summary: {
    folderName: string;
    companyName: string;
    companyLogo: string | null;
    uploadExpiresAt: Date | null;
    isOpen: boolean;
  };
}

const formatDeadline = (deadline: Date) =>
  new Date(deadline).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function UploadLinkPublicView({ uploadToken, summary }: UploadLinkPublicViewProps) {
  const uploaderToken = useUploaderToken();
  const { data: link } = usePublicNboxUploadLink(uploadToken, uploaderToken);
  const { uploadFiles, progress, isUploading } = usePublicNboxUpload(uploadToken, uploaderToken);
  const deleteUpload = useDeletePublicNboxUpload();
  const [senderName, setSenderName] = useState("");

  const isOpen = link?.isOpen ?? summary.isOpen;
  const myItems = link?.myItems ?? [];

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejections: FileRejection[]) => {
      if (rejections.length) toast.error(`${rejections.length} arquivo(s) passam de 5 GB e não foram enviados.`);
      if (!acceptedFiles.length) return;
      const result = await uploadFiles(acceptedFiles, senderName);
      if (result.uploadedCount) {
        toast.success(`${result.uploadedCount} ${result.uploadedCount === 1 ? "arquivo enviado" : "arquivos enviados"}.`);
      }
      for (const failure of result.failures) toast.error(`${failure.fileName}: ${failure.message}`);
    },
    [senderName, uploadFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: NBOX_MAX_FILE_BYTES,
    disabled: !isOpen || isUploading || !uploaderToken,
  });

  const handleDelete = (itemId: string) => {
    if (!uploaderToken) return;
    deleteUpload.mutate(
      { uploadToken, uploaderToken, itemId },
      {
        onSuccess: () => toast.success("Arquivo apagado."),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="gap-1">
          <p className="text-sm text-muted-foreground">{summary.companyName} pediu arquivos para você</p>
          <CardTitle className="text-xl">{summary.folderName}</CardTitle>
          {isOpen && summary.uploadExpiresAt && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ClockIcon className="size-4" />
              Envie até {formatDeadline(summary.uploadExpiresAt)}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!isOpen ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Este link de envio foi encerrado. Peça um novo link para quem te enviou.
            </p>
          ) : (
            <>
              <Input
                placeholder="Seu nome (opcional)"
                value={senderName}
                maxLength={80}
                onChange={(event) => setSenderName(event.target.value)}
                disabled={isUploading}
              />
              <div
                {...getRootProps()}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center transition-colors",
                  isDragActive && "border-primary bg-primary/5",
                  isUploading && "cursor-default",
                )}
              >
                <input {...getInputProps()} />
                {progress ? (
                  <div className="w-full text-left">
                    <UploadProgressText progress={progress} />
                  </div>
                ) : (
                  <>
                    <UploadIcon className="size-6 text-muted-foreground" />
                    <p className="text-sm font-medium">Arraste ou clique para escolher arquivos</p>
                    <p className="text-xs text-muted-foreground">Fotos, vídeos, documentos · até 5 GB cada</p>
                  </>
                )}
              </div>
              {myItems.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <CheckCircle2Icon className="size-4 text-primary" />
                    Você já enviou
                  </p>
                  <ul className="divide-y rounded-md border">
                    {myItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 p-3">
                        <FileTypeIcon type="FILE" mimeType={item.mimeType} className="size-5" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          {item.size !== null && <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Apagar ${item.name}`}
                          disabled={deleteUpload.isPending || isUploading}
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Só você vê esta lista, neste navegador.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
