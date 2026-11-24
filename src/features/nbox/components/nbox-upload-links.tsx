"use client";

import { useState } from "react";
import { CheckIcon, ClockIcon, CopyIcon, InboxIcon, MoreHorizontalIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { useCreateNboxUploadLink, useNboxUploadLinks, useUpdateNboxUploadLink } from "../hooks/use-nbox-upload-links";
import { NBOX_UPLOAD_LINK_DAY_OPTIONS, NBOX_UPLOAD_LINK_DEFAULT_DAYS, type NboxUploadLinkDays } from "../lib/storage-limits";
import { MOBILE_SHEET_CLASSNAME, NboxDayChips, copyNboxPublicLink, dayLabel, formatExpiry, toAbsoluteUrl } from "./nbox-transfers";
import { formatBytes } from "./nbox-file-type-icon";
import type { NBoxFolderView } from "./nbox-types";

// Link para cliente sem conta enviar arquivos a uma pasta (spec 0149).

const uploadLinkPath = (uploadToken: string) => `/enviar/${uploadToken}`;

export const canReceiveUploadLink = (folder: NBoxFolderView | undefined) => !!folder && !folder.isRestricted && !folder.systemKey;

// ─── Pedir arquivos ──────────────────────────────────────────────────────────

export function NewUploadLinkModal({
  open,
  onClose,
  currentFolder,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Pasta aberta: pode receber o link em vez de criar uma nova. */
  currentFolder?: NBoxFolderView;
  onCreated: (folderId: string) => void;
}) {
  const canUseCurrentFolder = canReceiveUploadLink(currentFolder) && !currentFolder?.uploadToken;
  const [useCurrentFolder, setUseCurrentFolder] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState<NboxUploadLinkDays>(NBOX_UPLOAD_LINK_DEFAULT_DAYS);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const createUploadLink = useCreateNboxUploadLink();

  const isUsingCurrentFolder = useCurrentFolder && canUseCurrentFolder;
  const canSubmit = isUsingCurrentFolder || name.trim().length > 0;

  const resetAndClose = () => {
    setName("");
    setDays(NBOX_UPLOAD_LINK_DEFAULT_DAYS);
    setCreatedPath(null);
    setIsCopied(false);
    setUseCurrentFolder(false);
    onClose();
  };

  const handleCreate = () => {
    createUploadLink.mutate(
      {
        days,
        target: isUsingCurrentFolder
          ? { kind: "existing", folderId: currentFolder!.id }
          : { kind: "new", name: name.trim(), parentId: canReceiveUploadLink(currentFolder) ? currentFolder!.id : null },
      },
      {
        onSuccess: (link) => {
          setCreatedPath(link.path);
          onCreated(link.folderId);
          emitTourResult({ kind: GUIDE_RESULT_KINDS.nboxUploadLinkCreated });
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleCopy = async () => {
    if (!createdPath) return;
    await copyNboxPublicLink(createdPath);
    setIsCopied(true);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !createUploadLink.isPending && resetAndClose()}>
      <DialogContent className={MOBILE_SHEET_CLASSNAME}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <InboxIcon className="size-4" /> {createdPath ? "Link de envio pronto" : "Pedir arquivos"}
          </DialogTitle>
          <DialogDescription>
            {createdPath
              ? `Quem tiver o link envia arquivos sem login, por ${dayLabel(days)}. Eles chegam nesta pasta e ficam guardados.`
              : "Gere um link para o cliente enviar arquivos direto numa pasta do Nbox, sem criar conta."}
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
            {canUseCurrentFolder && (
              <div className="flex gap-1.5">
                {[
                  { isCurrent: false, label: "Pasta nova" },
                  { isCurrent: true, label: `Esta pasta (${currentFolder!.name})` },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setUseCurrentFolder(option.isCurrent)}
                    className={cn(
                      "h-9 min-w-0 flex-1 truncate rounded-full border px-3 text-sm transition-colors",
                      useCurrentFolder === option.isCurrent ? "border-foreground bg-foreground text-background" : "border-line hover:bg-muted",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {!isUsingCurrentFolder && (
              <Input
                placeholder="Nome da pasta, ex.: Fotos – Cliente Silva"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                disabled={createUploadLink.isPending}
                autoFocus
              />
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">O link aceita arquivos por</p>
              <NboxDayChips options={NBOX_UPLOAD_LINK_DAY_OPTIONS} value={days} onChange={setDays} disabled={createUploadLink.isPending} />
            </div>
            <Button
              className="h-11 w-full rounded-full"
              disabled={!canSubmit || createUploadLink.isPending}
              onClick={handleCreate}
              data-guide={GUIDE_ANCHORS.nboxRequestFilesCreateButton.id}
            >
              <InboxIcon className="size-4" />
              {createUploadLink.isPending ? "Criando..." : "Criar link de envio"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O cliente vê só o que ele mesmo enviou. Até 5 GB por arquivo e 20 GB por link, dentro do espaço do Nbox.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Ações do link (faixa da pasta e lista de pedidos) ───────────────────────

function UploadLinkActionsMenu({ folderId, path, isOpen }: { folderId: string; path: string; isOpen: boolean }) {
  const updateUploadLink = useUpdateNboxUploadLink();

  const runUpdate = (
    action: { kind: "extend"; days: NboxUploadLinkDays } | { kind: "end" } | { kind: "regenerate"; days: NboxUploadLinkDays },
    successMessage: string,
  ) =>
    updateUploadLink.mutate(
      { folderId, action },
      {
        onSuccess: () => toast.success(successMessage),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" aria-label="Ações do link de envio">
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isOpen ? (
          <>
            <DropdownMenuItem className="sm:hidden" onSelect={() => copyNboxPublicLink(path)}>
              <CopyIcon className="size-4" /> Copiar link
            </DropdownMenuItem>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Prorrogar a partir de agora</DropdownMenuLabel>
            {NBOX_UPLOAD_LINK_DAY_OPTIONS.map((days) => (
              <DropdownMenuItem key={days} onSelect={() => runUpdate({ kind: "extend", days }, "Prazo do link prorrogado.")}>
                <ClockIcon className="size-4" /> Mais {dayLabel(days)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={() => runUpdate({ kind: "end" }, "Link encerrado. O cliente não envia mais.")}>
              <XIcon className="size-4" /> Encerrar já
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Gerar link novo (o antigo não volta)</DropdownMenuLabel>
            {NBOX_UPLOAD_LINK_DAY_OPTIONS.map((days) => (
              <DropdownMenuItem key={days} onSelect={() => runUpdate({ kind: "regenerate", days }, "Link novo gerado. Copie e mande para o cliente.")}>
                <RefreshCwIcon className="size-4" /> Válido por {dayLabel(days)}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Faixa da pasta com link ─────────────────────────────────────────────────

export function UploadLinkBanner({ folder }: { folder: NBoxFolderView }) {
  if (!folder.uploadToken || !folder.uploadExpiresAt) return null;

  const isOpen = new Date(folder.uploadExpiresAt) > new Date();
  const path = uploadLinkPath(folder.uploadToken);

  return (
    <div className="mb-4 flex items-center gap-3 rounded-[18px] border border-line bg-card p-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", isOpen ? "bg-primary/10" : "bg-muted")}>
        <InboxIcon className={cn("size-4", isOpen ? "text-primary" : "text-muted-foreground")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{isOpen ? "Recebendo arquivos por link" : "Link de envio encerrado"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {isOpen ? `Clientes podem enviar até ${formatExpiry(folder.uploadExpiresAt)}` : "O cliente não consegue mais enviar nem apagar."}
        </p>
      </div>
      {isOpen && (
        <Button size="sm" variant="outline" className="rounded-full max-sm:hidden" onClick={() => copyNboxPublicLink(path)}>
          <CopyIcon className="size-4" /> Copiar link
        </Button>
      )}
      <UploadLinkActionsMenu folderId={folder.id} path={path} isOpen={isOpen} />
    </div>
  );
}

// ─── Seção Pedidos de arquivos ───────────────────────────────────────────────

export function NboxUploadLinksPanel({ onCreate, onOpenFolder }: { onCreate: () => void; onOpenFolder: (folderId: string) => void }) {
  const { uploadLinks, isLoading } = useNboxUploadLinks();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-20 rounded-[18px]" />
        ))}
      </div>
    );
  }

  if (uploadLinks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-4 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <InboxIcon className="size-5 text-muted-foreground" />
        </span>
        <div>
          <p className="font-semibold">Nenhum pedido de arquivos</p>
          <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">
            Gere um link para o cliente enviar fotos, vídeos e documentos direto numa pasta, sem criar conta.
          </p>
        </div>
        <Button className="h-11 rounded-full px-6" onClick={onCreate}>
          <InboxIcon className="size-4" /> Pedir arquivos
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {uploadLinks.map((uploadLink) => {
        const isOpen = new Date(uploadLink.uploadExpiresAt) > new Date();
        const receivedLabel =
          uploadLink.receivedCount === 0
            ? "Nada recebido ainda"
            : `${uploadLink.receivedCount} ${uploadLink.receivedCount === 1 ? "arquivo" : "arquivos"} · ${formatBytes(uploadLink.receivedBytes)}${
                uploadLink.lastReceivedAt ? ` · último em ${formatExpiry(uploadLink.lastReceivedAt)}` : ""
              }`;
        return (
          <div key={uploadLink.folderId} className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-3">
            <button
              type="button"
              onClick={() => onOpenFolder(uploadLink.folderId)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label={`Abrir a pasta ${uploadLink.name}`}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", isOpen ? "bg-primary/10" : "bg-muted")}>
                <InboxIcon className={cn("size-4", isOpen ? "text-primary" : "text-muted-foreground")} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{uploadLink.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {isOpen ? `Recebendo até ${formatExpiry(uploadLink.uploadExpiresAt)}` : "Encerrado"} · {receivedLabel}
                </span>
              </span>
            </button>
            {isOpen && (
              <Button size="sm" variant="outline" className="rounded-full max-sm:hidden" onClick={() => copyNboxPublicLink(uploadLink.path)}>
                <CopyIcon className="size-4" /> Copiar link
              </Button>
            )}
            <UploadLinkActionsMenu folderId={uploadLink.folderId} path={uploadLink.path} isOpen={isOpen} />
          </div>
        );
      })}
      <p className="px-1 pt-1 text-xs text-muted-foreground">
        Clique num pedido para abrir a pasta. Os arquivos recebidos ficam guardados nela, mesmo depois que o link vence.
      </p>
    </div>
  );
}
