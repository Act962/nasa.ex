"use client";

import { useState } from "react";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LockIcon,
  MoreVerticalIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PublicVisibilityDialog } from "@/components/public-visibility-dialog";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useToggleNBoxItemPublic } from "../hooks/use-nbox";
import { FileTypeIcon, formatBytes } from "./nbox-file-type-icon";
import type { NBoxItemHrefResolver, NBoxItemView } from "./nbox-types";

/**
 * Quando o arquivo é privado: "Tornar público" abre o aviso explícito
 * (qualquer pessoa com o link acessa e baixa) e só então chama a mutation com
 * `consent: true`. O log vai para "Atividades no admin" pelo backend.
 */
function PublicVisibilityActions({ item }: { item: NBoxItemView }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const toggle = useToggleNBoxItemPublic();

  function copyPublicLink() {
    if (!item.publicToken) return;
    const url = `${window.location.origin}/api/nbox/public/${item.publicToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link público copiado!"),
      () => toast.error("Falha ao copiar o link."),
    );
  }

  return (
    <>
      {item.isPublic ? (
        <>
          <DropdownMenuItem onClick={copyPublicLink}>
            <CopyIcon className="size-3.5" />
            Copiar link público
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggle.mutate({ itemId: item.id, isPublic: false })}>
            <LockIcon className="size-3.5" />
            Tornar privado
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem
          onClick={(event) => {
            event.preventDefault();
            setIsConfirmOpen(true);
          }}
        >
          <GlobeIcon className="size-3.5" />
          Visualização Pública
        </DropdownMenuItem>
      )}

      <PublicVisibilityDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        isPending={toggle.isPending}
        onConfirm={() => {
          toggle.mutate(
            { itemId: item.id, isPublic: true, consent: true },
            { onSuccess: () => setIsConfirmOpen(false) },
          );
        }}
      />
    </>
  );
}

function PublicBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300"
      title="Este arquivo está visível publicamente"
    >
      <GlobeIcon className="size-2.5" />
      Público
    </span>
  );
}

export interface NBoxItemViewProps {
  item: NBoxItemView;
  /** Sem `onDelete` a ação de excluir some (modo leitura). */
  onDelete?: (itemId: string) => void;
  /** Sobrescreve o link padrão (URL pública do storage). */
  resolveHref?: NBoxItemHrefResolver;
  /** Esconde "Visualização Pública" — pasta restrita nunca publica. */
  canPublish?: boolean;
}

function useResolvedItemHref(item: NBoxItemView, resolveHref?: NBoxItemHrefResolver): string | null {
  const storageUrl = useConstructUrl(item.url ?? "");
  if (resolveHref) return resolveHref(item);
  if (!item.url) return null;
  const isStorageKey = !item.url.startsWith("http");
  return isStorageKey ? storageUrl : item.url;
}

function isImageItem(item: NBoxItemView): boolean {
  return item.type === "IMAGE" || (item.type === "FILE" && !!item.mimeType?.startsWith("image/"));
}

function ItemActionsMenuItems({
  item,
  resolvedUrl,
  onDelete,
  canPublish,
}: {
  item: NBoxItemView;
  resolvedUrl: string | null;
  onDelete?: (itemId: string) => void;
  canPublish: boolean;
}) {
  const isLink = item.type === "LINK";
  return (
    <>
      {resolvedUrl && (
        <DropdownMenuItem asChild>
          <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" download={!isLink}>
            {isLink ? <ExternalLinkIcon className="size-3.5" /> : <DownloadIcon className="size-3.5" />}
            {isLink ? "Abrir link" : "Baixar"}
          </a>
        </DropdownMenuItem>
      )}
      {canPublish && (
        <>
          <DropdownMenuSeparator />
          <PublicVisibilityActions item={item} />
        </>
      )}
      {onDelete && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(item.id)}>
            <TrashIcon className="size-3.5" /> Excluir
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

export function ItemCardGrid({ item, onDelete, resolveHref, canPublish = true }: NBoxItemViewProps) {
  const resolvedUrl = useResolvedItemHref(item, resolveHref);
  const isImagePreview = isImageItem(item) && !!resolvedUrl;

  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all">
      <div className="h-28 bg-muted/30 flex items-center justify-center overflow-hidden">
        {isImagePreview ? (
          <img src={resolvedUrl ?? undefined} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <FileTypeIcon type={item.type} mimeType={item.mimeType} className="size-10 opacity-60" />
        )}
      </div>

      {item.isPublic && (
        <div className="absolute top-2 left-2">
          <PublicBadge />
        </div>
      )}

      <div className="px-3 py-2.5">
        <p className="text-xs font-medium truncate leading-tight">{item.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {item.size ? formatBytes(item.size) : item.type.toLowerCase()}
        </p>
      </div>

      <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Ações do arquivo"
              className="p-1 bg-background/90 backdrop-blur rounded-lg border border-border shadow-sm"
            >
              <MoreVerticalIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ItemActionsMenuItems item={item} resolvedUrl={resolvedUrl} onDelete={onDelete} canPublish={canPublish} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function ItemRowList({ item, onDelete, resolveHref, canPublish = true }: NBoxItemViewProps) {
  const resolvedUrl = useResolvedItemHref(item, resolveHref);
  const isImagePreview = isImageItem(item) && !!resolvedUrl;

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
      <div className="size-9 shrink-0 rounded-lg overflow-hidden bg-muted/40 flex items-center justify-center">
        {isImagePreview ? (
          <img src={resolvedUrl ?? undefined} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <FileTypeIcon type={item.type} mimeType={item.mimeType} className="size-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{item.name}</p>
          {item.isPublic && <PublicBadge />}
        </div>
        {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
      </div>
      <div className="shrink-0 hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
        <span>{item.size ? formatBytes(item.size) : "—"}</span>
        <span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Ações do arquivo"
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
          >
            <MoreVerticalIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ItemActionsMenuItems item={item} resolvedUrl={resolvedUrl} onDelete={onDelete} canPublish={canPublish} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
