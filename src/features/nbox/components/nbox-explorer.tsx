"use client";

import { useMemo, useState } from "react";
import {
  BoxIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderLockIcon,
  GridIcon,
  ListIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import { useDeleteNBoxItem, useNBoxFolders, useNBoxItems } from "../hooks/use-nbox";
import { ItemCardGrid, ItemRowList } from "./nbox-item-views";
import type { NBoxFolderView, NBoxItemHrefResolver, NBoxViewMode } from "./nbox-types";

export interface NBoxExplorerProps {
  /** Pasta a partir da qual a árvore é mostrada; o breadcrumb não sobe além dela. */
  rootFolderId: string;
  /** Sem excluir nem publicar — só navegar e baixar. */
  readOnly?: boolean;
  resolveHref?: NBoxItemHrefResolver;
  /** Quando presente, mostra "Enviar" e devolve a pasta aberta. */
  onUploadClick?: (currentFolderId: string) => void;
  className?: string;
}

function buildBreadcrumb(folders: NBoxFolderView[], currentFolderId: string, rootFolderId: string): NBoxFolderView[] {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const trail: NBoxFolderView[] = [];
  let cursorId: string | null = currentFolderId;
  while (cursorId) {
    const folder = foldersById.get(cursorId);
    if (!folder) break;
    trail.unshift(folder);
    if (folder.id === rootFolderId) break;
    cursorId = folder.parentId;
  }
  return trail;
}

export function NBoxExplorer({ rootFolderId, readOnly = false, resolveHref, onUploadClick, className }: NBoxExplorerProps) {
  const [currentFolderId, setCurrentFolderId] = useState(rootFolderId);
  const [viewMode, setViewMode] = useState<NBoxViewMode>("grid");
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);

  const { folders, isLoading: isFoldersLoading } = useNBoxFolders();
  const { items, isLoading: isItemsLoading } = useNBoxItems({ folderId: currentFolderId });
  const deleteItem = useDeleteNBoxItem();

  const folderViews = folders as NBoxFolderView[];
  const currentFolder = folderViews.find((folder) => folder.id === currentFolderId);
  const childFolders = useMemo(
    () => folderViews.filter((folder) => folder.parentId === currentFolderId),
    [folderViews, currentFolderId],
  );
  const breadcrumb = useMemo(
    () => buildBreadcrumb(folderViews, currentFolderId, rootFolderId),
    [folderViews, currentFolderId, rootFolderId],
  );

  const canPublish = !readOnly && !currentFolder?.isRestricted;
  const isLoading = isFoldersLoading || isItemsLoading;
  const isEmpty = !isLoading && childFolders.length === 0 && items.length === 0;

  if (!isFoldersLoading && !folderViews.some((folder) => folder.id === rootFolderId)) {
    return (
      <div className={cn("rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground", className)}>
        Você não tem acesso a esta pasta.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Caminho da pasta" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          {breadcrumb.map((folder, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <span key={folder.id} className="flex min-w-0 items-center gap-1">
                {index > 0 && <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />}
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className={cn(
                    "truncate rounded px-1 py-0.5",
                    isLast ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {folder.name}
                </button>
              </span>
            );
          })}
        </nav>
        <div className="flex gap-0.5 rounded-lg border border-border p-0.5">
          <button
            type="button"
            aria-label="Ver em grade"
            onClick={() => setViewMode("grid")}
            className={cn("rounded-md p-1.5 transition-colors", viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50")}
          >
            <GridIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Ver em lista"
            onClick={() => setViewMode("list")}
            className={cn("rounded-md p-1.5 transition-colors", viewMode === "list" ? "bg-muted" : "hover:bg-muted/50")}
          >
            <ListIcon className="size-3.5" />
          </button>
        </div>
        {onUploadClick && (
          <Button size="sm" onClick={() => onUploadClick(currentFolderId)}>
            <UploadIcon className="size-3.5" /> Enviar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className={cn("gap-3", viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "flex flex-col")}>
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className={viewMode === "grid" ? "h-36 rounded-xl" : "h-14 rounded-xl"} />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
          <BoxIcon className="mb-3 size-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Esta pasta está vazia</p>
          {onUploadClick && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => onUploadClick(currentFolderId)}>
              <UploadIcon className="size-3.5" /> Enviar arquivo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {childFolders.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {childFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40"
                >
                  {folder.isRestricted ? (
                    <FolderLockIcon className="size-4 shrink-0" style={{ color: folder.color ?? undefined }} />
                  ) : (
                    <FolderIcon className="size-4 shrink-0 text-yellow-500" />
                  )}
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
          {items.length > 0 &&
            (viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => (
                  <ItemCardGrid
                    key={item.id}
                    item={item}
                    resolveHref={resolveHref}
                    canPublish={canPublish}
                    onDelete={readOnly ? undefined : setPendingDeleteItemId}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <ItemRowList
                    key={item.id}
                    item={item}
                    resolveHref={resolveHref}
                    canPublish={canPublish}
                    onDelete={readOnly ? undefined : setPendingDeleteItemId}
                  />
                ))}
              </div>
            ))}
        </div>
      )}

      {!readOnly && (
        <AlertDialog open={!!pendingDeleteItemId} onOpenChange={(isOpen) => !isOpen && setPendingDeleteItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir item?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!pendingDeleteItemId) return;
                  await deleteItem.mutateAsync({ itemId: pendingDeleteItemId });
                  setPendingDeleteItemId(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
