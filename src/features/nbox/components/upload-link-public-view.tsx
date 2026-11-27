"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { CheckCircle2Icon, ClockIcon, EyeIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NBOX_MAX_FILE_BYTES } from "../lib/storage-limits";
import {
  useDeletePublicNboxUpload,
  useOpenPublicNboxUpload,
  usePublicNboxUpload,
  usePublicNboxUploadLink,
  useUploaderToken,
} from "../hooks/use-nbox-upload-links";
import { FileTypeIcon, formatBytes } from "./nbox-file-type-icon";
import { UploadProgressText } from "./nbox-modals";
import { UploadLinkFilePreviewDialog, getUploadLinkPreviewKind, type UploadLinkPreviewFile } from "./upload-link-file-preview";

// Página pública do link de envio (spec 0149): o cliente, sem conta, envia arquivos para uma pasta do Nbox.

interface UploadLinkPublicViewProps {
  uploadToken: string;
  summary: {
    folderName: string;
    companyName: string;
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
  const openUpload = useOpenPublicNboxUpload();
  const [senderName, setSenderName] = useState("");
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadLinkPreviewFile | null>(null);

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

  const handleOpen = (item: { id: string; name: string; mimeType: string | null }) => {
    if (!uploaderToken) return;
    if (getUploadLinkPreviewKind(item.mimeType)) {
      setPreviewFile({ ...item, url: null });
      openUpload.mutate(
        { uploadToken, uploaderToken, itemId: item.id },
        {
          // Só preenche se a prévia aberta ainda é deste arquivo (o cliente pode ter trocado no meio).
          onSuccess: ({ url }) => setPreviewFile((current) => (current?.id === item.id ? { ...current, url } : current)),
          onError: (error) => {
            setPreviewFile(null);
            toast.error(error.message);
          },
        },
      );
      return;
    }
    // A aba nasce no clique: aberta depois da resposta, o navegador bloquearia como pop-up.
    const fileTab = window.open("", "_blank");
    openUpload.mutate(
      { uploadToken, uploaderToken, itemId: item.id },
      {
        onSuccess: ({ url }) => {
          if (!fileTab) {
            window.location.assign(url);
            return;
          }
          fileTab.opener = null;
          fileTab.location.href = url;
        },
        onError: (error) => {
          fileTab?.close();
          toast.error(error.message);
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!uploaderToken || !itemToDelete) return;
    deleteUpload.mutate(
      { uploadToken, uploaderToken, itemId: itemToDelete.id },
      {
        onSuccess: () => {
          toast.success("Arquivo apagado.");
          setItemToDelete(null);
        },
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
                        <button
                          type="button"
                          onClick={() => handleOpen(item)}
                          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                          aria-label={`Abrir ${item.name}`}
                        >
                          <FileTypeIcon type="FILE" mimeType={item.mimeType} className="size-5" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium group-hover:underline">{item.name}</span>
                            {item.size !== null && (
                              <span className="block text-xs text-muted-foreground">{formatBytes(item.size)}</span>
                            )}
                          </span>
                          <EyeIcon className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Apagar ${item.name}`}
                          disabled={deleteUpload.isPending || isUploading}
                          onClick={() => setItemToDelete({ id: item.id, name: item.name })}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Clique num arquivo para ver. Só você vê esta lista, neste navegador.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <UploadLinkFilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      <AlertDialog open={itemToDelete !== null} onOpenChange={(isDialogOpen) => !isDialogOpen && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{itemToDelete?.name}&rdquo; será apagado e {summary.companyName} não vai mais recebê-lo. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUpload.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={deleteUpload.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {deleteUpload.isPending ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
