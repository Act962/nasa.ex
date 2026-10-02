"use client";

import { useState } from "react";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileCheckIcon,
  FilePenIcon,
  FileTextIcon,
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
import { cn } from "@/lib/utils";
import { useToggleNBoxItemPublic } from "../hooks/use-nbox";
import {
  getFaviconUrl,
  getItemMetaLine,
  getItemPreviewKind,
  getLinkHostname,
  type NBoxItemPreviewKind,
} from "../lib/item-preview";
import { FileTypeIcon } from "./nbox-file-type-icon";
import type { NBoxItemHrefResolver, NBoxItemView } from "./nbox-types";

/** Classe da grade de cartões — o contêiner mora em `nbox-app.tsx`. */
export const NBOX_ITEM_GRID_CLASSNAME = "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4";

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

export function NBoxPublicBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success",
        className,
      )}
      title="Este arquivo está visível publicamente"
    >
      <GlobeIcon className="size-3" />
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
  /** Toque no cartão/linha (fora do menu ⋮) — abre a pré-visualização. */
  onOpen?: (item: NBoxItemView) => void;
  className?: string;
}

export function useResolvedItemHref(item: NBoxItemView, resolveHref?: NBoxItemHrefResolver): string | null {
  const storageUrl = useConstructUrl(item.url ?? "");
  if (resolveHref) return resolveHref(item);
  if (!item.url) return null;
  const isStorageKey = !item.url.startsWith("http");
  return isStorageKey ? storageUrl : item.url;
}

export function ItemActionsMenuItems({
  item,
  resolvedUrl,
  onDelete,
  canPublish,
  isPrimaryActionHidden = false,
}: {
  item: NBoxItemView;
  resolvedUrl: string | null;
  onDelete?: (itemId: string) => void;
  canPublish: boolean;
  /** Esconde "Baixar/Abrir link" quando a tela já mostra esse botão. */
  isPrimaryActionHidden?: boolean;
}) {
  const isLink = item.type === "LINK";
  const hasPrimaryAction = !!resolvedUrl && !isPrimaryActionHidden;
  return (
    <>
      {hasPrimaryAction && (
        <DropdownMenuItem asChild>
          <a href={resolvedUrl ?? undefined} target="_blank" rel="noopener noreferrer" download={!isLink}>
            {isLink ? <ExternalLinkIcon className="size-3.5" /> : <DownloadIcon className="size-3.5" />}
            {isLink ? "Abrir link" : "Baixar"}
          </a>
        </DropdownMenuItem>
      )}
      {canPublish && (
        <>
          {hasPrimaryAction && <DropdownMenuSeparator />}
          <PublicVisibilityActions item={item} />
        </>
      )}
      {onDelete && (
        <>
          {(hasPrimaryAction || canPublish) && <DropdownMenuSeparator />}
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(item.id)}>
            <TrashIcon className="size-3.5" /> Excluir
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

const KIND_TILE_CLASSNAMES: Record<NBoxItemPreviewKind, string> = {
  image: "bg-warning/10 text-warning",
  pdf: "bg-destructive/10 text-destructive",
  link: "bg-info/10 text-info",
  contract: "bg-success/10 text-success",
  proposal: "bg-info/10 text-info",
  spreadsheet: "bg-success/10 text-success",
  file: "bg-muted text-muted-foreground",
};

type ItemThumbSize = "card" | "row";

/** Miniatura leve (sem iframe): imagem, favicon do link ou ícone do tipo num quadro colorido. */
export function NBoxItemThumb({
  item,
  resolvedUrl,
  size,
  className,
}: {
  item: NBoxItemView;
  resolvedUrl: string | null;
  size: ItemThumbSize;
  className?: string;
}) {
  const [hasImageFailed, setHasImageFailed] = useState(false);
  const previewKind = getItemPreviewKind(item);
  const isCard = size === "card";
  const tileClassName = cn(
    "flex size-full flex-col items-center justify-center gap-1.5",
    KIND_TILE_CLASSNAMES[previewKind],
    className,
  );

  if (previewKind === "image" && resolvedUrl && !hasImageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL do storage, sem otimizador do Next
      <img
        src={resolvedUrl}
        alt={item.name}
        loading="lazy"
        decoding="async"
        onError={() => setHasImageFailed(true)}
        className={cn("size-full object-cover", className)}
      />
    );
  }

  if (previewKind === "link") {
    const hostname = getLinkHostname(item.url);
    return (
      <div className={tileClassName}>
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-card shadow-sm",
            isCard ? "size-12" : "size-7",
          )}
        >
          {hostname && !hasImageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- favicon externo
            <img
              src={getFaviconUrl(hostname)}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setHasImageFailed(true)}
              className={isCard ? "size-6" : "size-4"}
            />
          ) : (
            <FileTypeIcon type={item.type} mimeType={item.mimeType} className={isCard ? "size-6" : "size-4"} />
          )}
        </span>
        {isCard && hostname && (
          <span className="max-w-[85%] truncate text-[11px] font-medium text-foreground/70">{hostname}</span>
        )}
      </div>
    );
  }

  const KindIcon =
    previewKind === "pdf"
      ? FileTextIcon
      : previewKind === "contract"
        ? FilePenIcon
        : previewKind === "proposal"
          ? FileCheckIcon
          : null;
  const kindLabel =
    previewKind === "pdf"
      ? "PDF"
      : previewKind === "contract"
        ? "Contrato"
        : previewKind === "proposal"
          ? "Proposta"
          : null;
  const iconClassName = isCard ? "size-9" : "size-5";

  return (
    <div className={tileClassName}>
      {KindIcon ? (
        <KindIcon className={iconClassName} />
      ) : (
        <FileTypeIcon type={item.type} mimeType={item.mimeType} className={cn(iconClassName, "text-current")} />
      )}
      {isCard && kindLabel && (
        <span className="rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
          {kindLabel}
        </span>
      )}
    </div>
  );
}

function ItemMenuTrigger({ className }: { className?: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label="Ações do arquivo"
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <MoreVerticalIcon className="size-4" />
      </button>
    </DropdownMenuTrigger>
  );
}

export function ItemCardGrid({
  item,
  onDelete,
  resolveHref,
  canPublish = true,
  onOpen,
  className,
}: NBoxItemViewProps) {
  const resolvedUrl = useResolvedItemHref(item, resolveHref);
  const hasMenu = !!resolvedUrl || canPublish || !!onDelete;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[20px] border border-line bg-card transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        disabled={!onOpen}
        aria-label={`Abrir ${item.name}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
      >
        <div className="aspect-[4/3] overflow-hidden bg-muted/40">
          <NBoxItemThumb item={item} resolvedUrl={resolvedUrl} size="card" />
        </div>
        <div className="space-y-1 px-3 pb-3 pt-2.5">
          <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug">{item.name}</p>
          <p className="truncate text-[12px] text-muted-foreground">{getItemMetaLine(item)}</p>
          {item.isPublic && <NBoxPublicBadge />}
        </div>
      </button>

      {hasMenu && (
        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <ItemMenuTrigger className="bg-card/90 text-foreground shadow-sm backdrop-blur hover:bg-card" />
            <DropdownMenuContent align="end">
              <ItemActionsMenuItems
                item={item}
                resolvedUrl={resolvedUrl}
                onDelete={onDelete}
                canPublish={canPublish}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

export function ItemRowList({
  item,
  onDelete,
  resolveHref,
  canPublish = true,
  onOpen,
  className,
}: NBoxItemViewProps) {
  const resolvedUrl = useResolvedItemHref(item, resolveHref);
  const hasMenu = !!resolvedUrl || canPublish || !!onDelete;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-[18px] border border-line bg-card pr-1.5 transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        disabled={!onOpen}
        aria-label={`Abrir ${item.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] py-2 pl-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        <div className="size-12 shrink-0 overflow-hidden rounded-[14px] bg-muted/40">
          <NBoxItemThumb item={item} resolvedUrl={resolvedUrl} size="row" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold">{item.name}</p>
            {item.isPublic && <NBoxPublicBadge className="shrink-0" />}
          </div>
          <p className="truncate text-[12px] text-muted-foreground">{getItemMetaLine(item)}</p>
        </div>
      </button>

      {hasMenu && (
        <DropdownMenu>
          <ItemMenuTrigger className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground" />
          <DropdownMenuContent align="end">
            <ItemActionsMenuItems item={item} resolvedUrl={resolvedUrl} onDelete={onDelete} canPublish={canPublish} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
