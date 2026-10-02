"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FolderIcon, Link2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateNBoxFolder, useCreateNBoxItem } from "../hooks/use-nbox";
import { useSpacePointCtx } from "@/features/space-point/components/space-point-provider";
import { NBoxItemType } from "@/generated/prisma/enums";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

/** Janelas do N-Box (enviar arquivo, novo link, nova pasta): no celular viram gaveta de baixo. */

// ─── Upload Modal ─────────────────────────────────────────────────────────────

export function UploadModal({
  open,
  onClose,
  folderId,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
}) {
  const createItem = useCreateNBoxItem();
  const { earn } = useSpacePointCtx();
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setUploading(true);
      let successCount = 0;
      for (const file of acceptedFiles) {
        try {
          // Get presigned URL
          const isImage = file.type.startsWith("image/");
          const res = await fetch("/api/s3/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              size: file.size,
              isImage,
            }),
          });
          const { presignedUrl, key } = await res.json();
          const url = presignedUrl;

          // Upload to S3
          await fetch(url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          // Create item
          const itemType: NBoxItemType = isImage
            ? NBoxItemType.IMAGE
            : NBoxItemType.FILE;
          await createItem.mutateAsync({
            folderId,
            type: itemType,
            name: file.name,
            url: key,
            mimeType: file.type,
            size: file.size,
          });
          successCount++;
        } catch (e) {
          toast.error(`Erro ao enviar ${file.name}`);
        }
      }
      setUploading(false);
      if (successCount > 0) {
        earn("upload_nbox", "Upload de arquivo no N.Box");
        emitTourResult({ kind: GUIDE_RESULT_KINDS.nboxFileUploaded });
      }
      onClose();
    },
    [createItem, folderId, earn, onClose],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.*": [],
      "text/*": [],
      "video/*": [],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: uploading,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="size-4" /> Enviar arquivos
          </DialogTitle>
        </DialogHeader>
        <div
          {...getRootProps()}
          data-guide={GUIDE_ANCHORS.nboxDropzone.id}
          className={cn(
            "cursor-pointer rounded-[20px] border-2 border-dashed p-8 text-center transition-colors sm:p-10",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40",
            uploading && "opacity-50 cursor-not-allowed",
          )}
        >
          <input {...getInputProps()} />
          <UploadIcon className="size-10 mx-auto mb-3 text-muted-foreground/50" />
          {uploading ? (
            <p className="text-sm text-muted-foreground">Enviando...</p>
          ) : isDragActive ? (
            <p className="text-sm font-medium text-primary">
              Solte os arquivos aqui
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">
                <span className="sm:hidden">Toque para escolher arquivos</span>
                <span className="max-sm:hidden">Arraste ou clique para selecionar</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Imagens, PDFs, documentos — até 50 MB
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Link Modal ───────────────────────────────────────────────────────────

export function NewLinkModal({
  open,
  onClose,
  folderId,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
}) {
  const createItem = useCreateNBoxItem();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;
    await createItem.mutateAsync({
      folderId,
      type: NBoxItemType.LINK,
      name: name.trim(),
      url: url.trim(),
      description: description.trim() || undefined,
    });
    setName("");
    setUrl("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2Icon className="size-4" /> Adicionar link
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Nome do link *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="URL (https://...) *"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || !url.trim() || createItem.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Folder Modal ─────────────────────────────────────────────────────────

export function NewFolderModal({
  open,
  onClose,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  parentId: string | null;
}) {
  const createFolder = useCreateNBoxFolder();
  const [name, setName] = useState("");
  const COLORS = [
    "#F59E0B",
    "#10B981",
    "#3B82F6",
    "#8B5CF6",
    "#EF4444",
    "#EC4899",
    "#6B7280",
  ];
  const [color, setColor] = useState(COLORS[0]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await createFolder.mutateAsync({
      name: name.trim(),
      parentId: parentId ?? undefined,
      color,
    });
    setName("");
    onClose();
    emitTourResult({ kind: GUIDE_RESULT_KINDS.nboxFolderCreated });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderIcon className="size-4" /> Nova pasta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Nome da pasta *"
            value={name}
            data-guide={GUIDE_ANCHORS.nboxFolderName.id}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "size-6 rounded-full transition-all",
                  color === c && "ring-2 ring-offset-2 ring-foreground",
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || createFolder.isPending}
              data-guide={GUIDE_ANCHORS.nboxFolderSubmit.id}
            >
              Criar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

