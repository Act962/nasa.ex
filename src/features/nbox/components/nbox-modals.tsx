"use client";

import { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FolderIcon, Link2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateNBoxFolder, useCreateNBoxItem } from "../hooks/use-nbox";
import { useNboxUpload, type NboxUploadProgress } from "../hooks/use-nbox-upload";
import { NBOX_MAX_FILE_BYTES } from "../lib/storage-limits";
import { formatBytes } from "./nbox-file-type-icon";
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
  const { uploadFiles, progress, isUploading } = useNboxUpload();
  const { earn } = useSpacePointCtx();

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      for (const rejected of rejectedFiles) toast.error(`${rejected.file.name}: arquivo maior que 5 GB.`);
      if (!acceptedFiles.length) return;
      const summary = await uploadFiles(acceptedFiles, folderId);
      for (const failure of summary.failures) toast.error(`${failure.fileName}: ${failure.message}`);
      if (summary.uploadedCount > 0) {
        toast.success(summary.uploadedCount === 1 ? "Arquivo enviado!" : `${summary.uploadedCount} arquivos enviados!`);
        earn("upload_nbox", "Upload de arquivo no N.Box");
        emitTourResult({ kind: GUIDE_RESULT_KINDS.nboxFileUploaded });
        onClose();
      }
    },
    [uploadFiles, folderId, earn, onClose],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: NBOX_MAX_FILE_BYTES,
    disabled: isUploading,
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
            isUploading && "opacity-50 cursor-not-allowed",
          )}
        >
          <input {...getInputProps()} />
          <UploadIcon className="size-10 mx-auto mb-3 text-muted-foreground/50" />
          {progress ? (
            <UploadProgressText progress={progress} />
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
                Qualquer arquivo, até 5 GB cada
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UploadProgressText({ progress }: { progress: NboxUploadProgress }) {
  const percent = progress.totalBytes ? Math.round((progress.loadedBytes / progress.totalBytes) * 100) : 0;
  return (
    <div className="space-y-2">
      <p className="truncate text-sm font-medium">
        {progress.fileCount > 1 && `${progress.fileIndex + 1} de ${progress.fileCount} · `}
        {progress.fileName}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatBytes(progress.loadedBytes)} de {formatBytes(progress.totalBytes)} · não feche esta janela
      </p>
    </div>
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

