"use client";

import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Prévia do arquivo na página pública do link de envio (spec 0149, RF-4a): vídeo, imagem, áudio e PDF tocam ali mesmo.

export interface UploadLinkPreviewFile {
  id: string;
  name: string;
  mimeType: string | null;
  /** `null` enquanto o link assinado está sendo gerado. */
  url: string | null;
}

type PreviewKind = "video" | "image" | "audio" | "pdf";

export function getUploadLinkPreviewKind(mimeType: string | null): PreviewKind | null {
  if (!mimeType) return null;
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  return null;
}

export function UploadLinkFilePreviewDialog({ file, onClose }: { file: UploadLinkPreviewFile | null; onClose: () => void }) {
  const previewKind = getUploadLinkPreviewKind(file?.mimeType ?? null);

  return (
    <Dialog open={file !== null} onOpenChange={(isDialogOpen) => !isDialogOpen && onClose()}>
      <DialogContent className="gap-3 sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-base">{file?.name}</DialogTitle>
          <DialogDescription className="sr-only">Prévia do arquivo enviado</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-md bg-muted/40">
          {!file?.url ? (
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          ) : previewKind === "video" ? (
            <video key={file.url} src={file.url} controls autoPlay playsInline className="max-h-[70dvh] w-full" />
          ) : previewKind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- link assinado do storage, sem otimizador do Next
            <img src={file.url} alt={file.name} className="max-h-[70dvh] w-full object-contain" />
          ) : previewKind === "audio" ? (
            <audio key={file.url} src={file.url} controls autoPlay className="w-full p-4" />
          ) : (
            <iframe src={file.url} title={file.name} className="h-[70dvh] w-full" />
          )}
        </div>
        {file?.url && (
          <Button asChild variant="outline" size="sm" className="self-end">
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-4" /> Abrir em outra aba
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
