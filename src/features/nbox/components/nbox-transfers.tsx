"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { CheckIcon, ClockIcon, CopyIcon, MoreHorizontalIcon, SendIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { useCreateNboxTransfer, useNboxTransfers, useUpdateNboxTransfer } from "../hooks/use-nbox-transfers";
import { useNboxUpload } from "../hooks/use-nbox-upload";
import {
  NBOX_MAX_FILE_BYTES,
  NBOX_TRANSFER_DAY_OPTIONS,
  NBOX_TRANSFER_DEFAULT_DAYS,
  NBOX_TRANSFER_MAX_DAYS,
  type NboxTransferDays,
} from "../lib/storage-limits";
import { FileTypeIcon, formatBytes } from "./nbox-file-type-icon";
import { UploadProgressText } from "./nbox-modals";
import type { NBoxItemView } from "./nbox-types";

// Transferências com prazo do Nbox (spec 0148): link público que some sozinho, como um WeTransfer dentro do ÓRBITA.

const MOBILE_SHEET_CLASSNAME =
  "max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100 max-w-md";

const dayLabel = (days: number) => (days === 1 ? "1 dia" : `${days} dias`);

const toAbsoluteUrl = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

async function copyTransferLink(path: string) {
  try {
    await navigator.clipboard.writeText(toAbsoluteUrl(path));
    toast.success("Link copiado!");
  } catch {
    toast.error("Não deu para copiar. Selecione o link e copie.");
  }
}

function formatExpiry(expiresAt: Date | string) {
  const date = new Date(expiresAt);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ─── Lista ────────────────────────────────────────────────────────────────────

export function NboxTransfersPanel({ onCreate }: { onCreate: () => void }) {
  const { transfers, isLoading } = useNboxTransfers();
  const updateTransfer = useUpdateNboxTransfer();

  const runUpdate = (transferId: string, action: { kind: "extend" } | { kind: "end" }) =>
    updateTransfer.mutate(
      { transferId, action },
      {
        onSuccess: () =>
          toast.success(action.kind === "end" ? "Transferência encerrada. O link parou de funcionar." : "Prazo prorrogado até o limite."),
        onError: (error) => toast.error(error.message),
      },
    );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-20 rounded-[18px]" />
        ))}
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-4 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <SendIcon className="size-5 text-muted-foreground" />
        </span>
        <div>
          <p className="font-semibold">Nenhuma transferência</p>
          <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">
            Mande arquivos pesados para clientes e parceiros por um link que se apaga sozinho depois do prazo.
          </p>
        </div>
        <Button className="h-11 rounded-full px-6" onClick={onCreate}>
          <SendIcon className="size-4" /> Nova transferência
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {transfers.map((transfer) => {
        const isExpired = new Date(transfer.expiresAt) <= new Date();
        const canExtend = new Date(transfer.expiresAt) < new Date(transfer.maxExpiresAt);
        const totalBytes = transfer.items.reduce((total, item) => total + (item.size ?? 0), 0);
        return (
          <div key={transfer.id} className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", isExpired ? "bg-muted" : "bg-primary/10")}>
              <SendIcon className={cn("size-4", isExpired ? "text-muted-foreground" : "text-primary")} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{transfer.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {transfer.items.length} {transfer.items.length === 1 ? "arquivo" : "arquivos"} · {formatBytes(totalBytes)} ·{" "}
                {isExpired ? "Expirou" : `Até ${formatExpiry(transfer.expiresAt)}`}
              </p>
            </div>
            {!isExpired && (
              <Button size="sm" variant="outline" className="rounded-full max-sm:hidden" onClick={() => copyTransferLink(transfer.path)}>
                <CopyIcon className="size-4" /> Copiar link
              </Button>
            )}
            {!isExpired && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" aria-label="Mais ações">
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="sm:hidden" onSelect={() => copyTransferLink(transfer.path)}>
                    <CopyIcon className="size-4" /> Copiar link
                  </DropdownMenuItem>
                  {canExtend && (
                    <DropdownMenuItem onSelect={() => runUpdate(transfer.id, { kind: "extend" })}>
                      <ClockIcon className="size-4" /> Prorrogar até {formatExpiry(transfer.maxExpiresAt)}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onSelect={() => runUpdate(transfer.id, { kind: "end" })}>
                    <XIcon className="size-4" /> Encerrar já
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
      <p className="px-1 pt-1 text-xs text-muted-foreground">
        Cada transferência vale no máximo {NBOX_TRANSFER_MAX_DAYS} dias. Depois disso, os arquivos são apagados em até 24 horas e, enquanto
        existem, contam no espaço do Nbox. O original guardado no Nbox não é apagado.
      </p>
    </div>
  );
}

// ─── Nova transferência ──────────────────────────────────────────────────────

export function NewTransferModal({
  open,
  onClose,
  initialItems = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Arquivos que já estão no Nbox (viram cópia na transferência). */
  initialItems?: NBoxItemView[];
}) {
  const [name, setName] = useState("");
  const [days, setDays] = useState<NboxTransferDays>(NBOX_TRANSFER_DEFAULT_DAYS);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingItems, setExistingItems] = useState<NBoxItemView[]>(initialItems);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const createTransfer = useCreateNboxTransfer();
  const { uploadFiles, progress, isUploading } = useNboxUpload();
  const isBusy = createTransfer.isPending || isUploading;

  const resetAndClose = () => {
    setName("");
    setDays(NBOX_TRANSFER_DEFAULT_DAYS);
    setNewFiles([]);
    setExistingItems([]);
    setCreatedPath(null);
    setIsCopied(false);
    onClose();
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    for (const rejected of rejectedFiles) toast.error(`${rejected.file.name}: arquivo maior que 5 GB.`);
    setNewFiles((current) => [...current, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxSize: NBOX_MAX_FILE_BYTES, disabled: isBusy });

  const fileCount = newFiles.length + existingItems.length;
  const totalBytes =
    newFiles.reduce((total, file) => total + file.size, 0) + existingItems.reduce((total, item) => total + (item.size ?? 0), 0);

  const handleCreate = async () => {
    try {
      const transfer = await createTransfer.mutateAsync({
        name: name.trim() || undefined,
        days,
        existingItemIds: existingItems.map((item) => item.id),
      });
      if (newFiles.length) {
        const summary = await uploadFiles(newFiles, transfer.transferId);
        for (const failure of summary.failures) toast.error(`${failure.fileName}: ${failure.message}`);
      }
      setCreatedPath(transfer.path);
      emitTourResult({ kind: GUIDE_RESULT_KINDS.nboxTransferCreated });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não deu para criar a transferência.");
    }
  };

  const handleCopy = async () => {
    if (!createdPath) return;
    await copyTransferLink(createdPath);
    setIsCopied(true);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isBusy && resetAndClose()}>
      <DialogContent className={MOBILE_SHEET_CLASSNAME}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="size-4" /> {createdPath ? "Transferência pronta" : "Nova transferência"}
          </DialogTitle>
          <DialogDescription>
            {createdPath
              ? `Quem tiver o link baixa os arquivos sem login, por ${dayLabel(days)}. Depois disso, eles são apagados.`
              : "Gere um link para mandar arquivos pesados. Os arquivos são apagados depois do prazo."}
          </DialogDescription>
        </DialogHeader>

        {createdPath ? (
          <div className="space-y-3">
            <Input readOnly value={toAbsoluteUrl(createdPath)} onFocus={(event) => event.currentTarget.select()} />
            <div className="flex gap-2">
              <Button className="flex-1 rounded-full" onClick={handleCopy}>
                {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                {isCopied ? "Copiado" : "Copiar link"}
              </Button>
              <Button variant="outline" className="rounded-full" onClick={resetAndClose}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input placeholder="Nome (opcional), ex.: Vídeos da campanha" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} disabled={isBusy} />

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">O link vale por</p>
              <div className="flex gap-1.5">
                {NBOX_TRANSFER_DAY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDays(option)}
                    className={cn(
                      "h-9 flex-1 rounded-full border text-sm transition-colors",
                      days === option ? "border-foreground bg-foreground text-background" : "border-line hover:bg-muted",
                    )}
                  >
                    {dayLabel(option)}
                  </button>
                ))}
              </div>
            </div>

            <div
              {...getRootProps()}
              data-guide={GUIDE_ANCHORS.nboxTransferDropzone.id}
              className={cn(
                "cursor-pointer rounded-[20px] border-2 border-dashed p-6 text-center transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                isBusy && "cursor-not-allowed opacity-50",
              )}
            >
              <input {...getInputProps()} />
              {progress ? (
                <UploadProgressText progress={progress} />
              ) : (
                <>
                  <UploadIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Arraste ou clique para escolher arquivos</p>
                  <p className="mt-1 text-xs text-muted-foreground">Até 5 GB cada</p>
                </>
              )}
            </div>

            {fileCount > 0 && (
              <ul className="max-h-40 divide-y overflow-y-auto rounded-[16px] border border-line">
                {existingItems.map((item) => (
                  <SelectedFileRow
                    key={item.id}
                    name={item.name}
                    sizeBytes={item.size ?? 0}
                    icon={<FileTypeIcon type={item.type} mimeType={item.mimeType} className="size-4" />}
                    onRemove={isBusy ? undefined : () => setExistingItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                  />
                ))}
                {newFiles.map((file, index) => (
                  <SelectedFileRow
                    key={`${file.name}-${index}`}
                    name={file.name}
                    sizeBytes={file.size}
                    icon={<UploadIcon className="size-4 text-muted-foreground" />}
                    onRemove={isBusy ? undefined : () => setNewFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  />
                ))}
              </ul>
            )}

            <Button
              className="h-11 w-full rounded-full"
              disabled={fileCount === 0 || isBusy}
              onClick={handleCreate}
              data-guide={GUIDE_ANCHORS.nboxTransferCreateButton.id}
            >
              <SendIcon className="size-4" />
              {isBusy ? "Enviando..." : fileCount > 0 ? `Criar link · ${fileCount} ${fileCount === 1 ? "arquivo" : "arquivos"} · ${formatBytes(totalBytes)}` : "Criar link"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SelectedFileRow({
  name,
  sizeBytes,
  icon,
  onRemove,
}: {
  name: string;
  sizeBytes: number;
  icon: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(sizeBytes)}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Tirar ${name}`} className="grid size-6 place-items-center rounded-full hover:bg-muted">
          <XIcon className="size-3.5" />
        </button>
      )}
    </li>
  );
}
