"use client";

import { DownloadIcon, ExternalLinkIcon, MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  formatRelativeDate,
  getFaviconUrl,
  getItemKindLabel,
  getItemPreviewKind,
  getLinkHostname,
} from "../lib/item-preview";
import { formatBytes } from "./nbox-file-type-icon";
import { ItemActionsMenuItems, NBoxItemThumb, NBoxPublicBadge, useResolvedItemHref } from "./nbox-item-views";
import type { NBoxItemHrefResolver, NBoxItemView } from "./nbox-types";

export interface NBoxItemPreviewSheetProps {
  /** `null` mantém a gaveta fechada (útil para guardar só o item selecionado no pai). */
  item: NBoxItemView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (itemId: string) => void;
  resolveHref?: NBoxItemHrefResolver;
  canPublish?: boolean;
}

export function NBoxItemPreviewSheet({ item, open, onOpenChange, ...contentProps }: NBoxItemPreviewSheetProps) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open && !!item} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "gap-0 p-0",
          isMobile ? "max-h-[92dvh] rounded-t-[26px]" : "rounded-[24px] sm:max-w-xl",
        )}
      >
        {item && <PreviewSheetBody item={item} onOpenChange={onOpenChange} {...contentProps} />}
      </SheetContent>
    </Sheet>
  );
}

function PreviewSheetBody({
  item,
  onOpenChange,
  onDelete,
  resolveHref,
  canPublish = true,
}: Omit<NBoxItemPreviewSheetProps, "item" | "open"> & { item: NBoxItemView }) {
  const resolvedUrl = useResolvedItemHref(item, resolveHref);
  const previewKind = getItemPreviewKind(item);
  const isOpenAction = item.type === "LINK" || previewKind === "contract" || previewKind === "proposal";
  const hasSecondaryActions = canPublish || !!onDelete;

  function deleteAndClose(itemId: string) {
    onDelete?.(itemId);
    onOpenChange(false);
  }

  const metaRows: { label: string; value: string }[] = [
    { label: "Tipo", value: getItemKindLabel(item) },
    ...(item.size ? [{ label: "Tamanho", value: formatBytes(item.size) }] : []),
    { label: "Adicionado", value: formatRelativeDate(item.createdAt) },
    { label: "Por", value: item.createdBy.name },
  ];

  return (
    <>
      <SheetHeader className="shrink-0 pr-14">
        <SheetTitle className="line-clamp-2 break-words text-base">{item.name}</SheetTitle>
        <SheetDescription className={cn(!item.description && "sr-only")}>
          {item.description || "Pré-visualização do arquivo"}
        </SheetDescription>
        {item.isPublic && <NBoxPublicBadge className="w-fit" />}
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <PreviewArea item={item} resolvedUrl={resolvedUrl} />

        <dl className="grid grid-cols-2 gap-2">
          {metaRows.map((metaRow) => (
            <div key={metaRow.label} className="min-w-0 rounded-[16px] bg-muted/50 px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{metaRow.label}</dt>
              <dd className="truncate text-[13px] font-medium">{metaRow.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-line p-4">
        {resolvedUrl && (
          <Button asChild className="h-12 flex-1 rounded-full text-[15px]">
            <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" download={!isOpenAction}>
              {isOpenAction ? (
                <ExternalLinkIcon className="size-4" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {isOpenAction ? "Abrir link" : "Baixar"}
            </a>
          </Button>
        )}
        {hasSecondaryActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Mais ações"
                className={cn("size-12 shrink-0 rounded-full", !resolvedUrl && "ml-auto")}
              >
                <MoreHorizontalIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <ItemActionsMenuItems
                item={item}
                resolvedUrl={resolvedUrl}
                onDelete={onDelete ? deleteAndClose : undefined}
                canPublish={canPublish}
                isPrimaryActionHidden
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}

function PreviewArea({ item, resolvedUrl }: { item: NBoxItemView; resolvedUrl: string | null }) {
  const previewKind = getItemPreviewKind(item);

  if (previewKind === "image" && resolvedUrl) {
    return (
      <div className="flex max-h-[60dvh] items-center justify-center overflow-hidden rounded-[20px] bg-muted/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL do storage, sem otimizador do Next */}
        <img src={resolvedUrl} alt={item.name} decoding="async" className="max-h-[60dvh] w-full object-contain" />
      </div>
    );
  }

  if (previewKind === "pdf" && resolvedUrl) {
    return (
      <iframe
        src={resolvedUrl}
        title={item.name}
        className="h-[60dvh] w-full rounded-[20px] border border-line bg-muted/40"
      />
    );
  }

  if (previewKind === "link") {
    const hostname = getLinkHostname(item.url);
    return (
      <div className="flex flex-col items-center gap-3 rounded-[20px] bg-info/10 px-4 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-card shadow-sm">
          {hostname ? (
            // eslint-disable-next-line @next/next/no-img-element -- favicon externo
            <img src={getFaviconUrl(hostname)} alt="" className="size-8" />
          ) : (
            <ExternalLinkIcon className="size-7 text-info" />
          )}
        </span>
        {hostname && <p className="text-sm font-semibold">{hostname}</p>}
        {item.url && <p className="w-full break-all text-[12px] text-muted-foreground">{item.url}</p>}
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] overflow-hidden rounded-[20px] bg-muted/40">
      <NBoxItemThumb item={item} resolvedUrl={resolvedUrl} size="card" />
    </div>
  );
}
