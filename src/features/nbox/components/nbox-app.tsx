"use client";

import { useState } from "react";
import {
  BoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderLockIcon,
  FolderPlusIcon,
  GridIcon,
  HardDriveIcon,
  Link2Icon,
  ListIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { AppReportButton } from "@/features/insights/components/app-report-button";
import { useDeleteNBoxFolder, useDeleteNBoxItem, useNBoxFolders, useNBoxItems, useNBoxStorage } from "../hooks/use-nbox";
import { formatBytes } from "./nbox-file-type-icon";
import { ItemCardGrid, ItemRowList, NBOX_ITEM_GRID_CLASSNAME } from "./nbox-item-views";
import { NBoxItemPreviewSheet } from "./nbox-item-preview-sheet";
import type { NBoxFolderView as NBoxFolder, NBoxItemView, NBoxViewMode as ViewMode } from "./nbox-types";
import { StorageBar } from "./nbox-sidebar-parts";
import { NBoxFolderNavigation, buildFolderPath } from "./nbox-folder-navigation";
import { UploadModal, NewLinkModal, NewFolderModal } from "./nbox-modals";

/** N-Box: drive da empresa — pastas, arquivos e links, com o menu de baixo no celular. */

// ─── Main NBox App Component ──────────────────────────────────────────────────

export function NBoxApp() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [isFoldersSheetOpen, setIsFoldersSheetOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<NBoxItemView | null>(null);

  const { folders, isLoading: foldersLoading } = useNBoxFolders();
  const { items, isLoading: itemsLoading } = useNBoxItems({
    folderId: selectedFolderId,
    search: search || undefined,
  });
  const { storage } = useNBoxStorage();
  const deleteItem = useDeleteNBoxItem();
  const deleteFolder = useDeleteNBoxFolder();

  const rootFolders = folders.filter((folder) => !folder.parentId);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);
  const folderPath = buildFolderPath(folders, selectedFolderId);
  const childFolders = folders.filter((folder) => folder.parentId === selectedFolderId);
  const canPublish = !selectedFolder?.isRestricted;

  // Celular: Enviar é a ação da tela — fica no centro do menu de baixo, no lugar do ASTRO.
  useRegisterOrbitDock({
    leftItems: [
      { label: "Arquivos", icon: <HardDriveIcon />, onSelect: () => setSelectedFolderId(null), isActive: selectedFolderId === null },
      { label: "Pastas", icon: <FolderIcon />, onSelect: () => setIsFoldersSheetOpen(true), isActive: isFoldersSheetOpen },
    ],
    rightItems: [
      { label: "Link", icon: <Link2Icon />, onSelect: () => setLinkOpen(true) },
      { label: "Nova pasta", icon: <FolderPlusIcon />, onSelect: () => setFolderOpen(true) },
    ],
    centerAction: { label: "Enviar", icon: <UploadIcon />, onSelect: () => setUploadOpen(true) },
  });

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    await deleteItem.mutateAsync({ itemId: deleteItemId });
    setDeleteItemId(null);
    if (previewItem?.id === deleteItemId) setPreviewItem(null);
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;
    await deleteFolder.mutateAsync({ folderId: deleteFolderId });
    if (selectedFolderId === deleteFolderId) setSelectedFolderId(null);
    setDeleteFolderId(null);
  };

  const selectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setIsFoldersSheetOpen(false);
  };

  const storageLabel = storage ? `${formatBytes(storage.usedBytes)} de ${formatBytes(storage.limitBytes)} usados` : "Seus arquivos e links";
  const ViewToggleIcon = viewMode === "grid" ? ListIcon : GridIcon;

  return (
    <div className="flex h-svh min-h-0 overflow-hidden">
      {/* ── Lateral (computador) ── */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-full bg-primary">
              <BoxIcon className="size-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">N-Box</span>
            <AppReportButton appModule="nbox" variant="ghost" className="ml-auto h-8 rounded-full px-2.5" />
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pt-2">
          <NBoxFolderNavigation
            folders={folders}
            rootFolders={rootFolders}
            isLoading={foldersLoading}
            selectedFolderId={selectedFolderId}
            onSelect={selectFolder}
            onDelete={setDeleteFolderId}
            onCreate={() => setFolderOpen(true)}
          />
        </div>
        <StorageBar />
      </aside>

      {/* ── Conteúdo ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <HeaderTracking title="N-Box" isTitleHidden />

        {/* Topo do celular: pasta atual como título, armazenamento embaixo. */}
        <div className="flex shrink-0 items-center gap-3 px-4 pt-1 pb-2 md:hidden">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary">
            <BoxIcon className="size-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl leading-tight font-bold tracking-tight">{selectedFolder?.name ?? "Todos os arquivos"}</h1>
            <p className="truncate text-xs text-muted-foreground">{storageLabel}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            aria-label={viewMode === "grid" ? "Ver em lista" : "Ver em grade"}
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            <ViewToggleIcon className="size-4" />
          </Button>
          <AppReportButton appModule="nbox" size="default" isCompactOnMobile className="rounded-full max-sm:size-10" />
        </div>

        {/* Barra do computador: caminho da pasta, busca, visualização e ações. */}
        <div className="hidden shrink-0 flex-wrap items-center gap-3 bg-background px-6 py-3 md:flex">
          <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted-foreground" aria-label="Caminho da pasta">
            <button type="button" onClick={() => setSelectedFolderId(null)} className={cn("truncate rounded-full px-2 py-1 hover:bg-muted", !selectedFolderId && "font-semibold text-foreground")}>
              Todos os arquivos
            </button>
            {folderPath.map((folder, index) => (
              <span key={folder.id} className="flex min-w-0 items-center gap-1">
                <ChevronRightIcon className="size-3.5 shrink-0" />
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={cn("truncate rounded-full px-2 py-1 hover:bg-muted", index === folderPath.length - 1 && "font-semibold text-foreground")}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </nav>
          <div className="relative w-56 shrink-0">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar arquivos" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 rounded-full pl-9 text-sm" />
          </div>
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {(["grid", "list"] as const).map((mode) => {
              const ModeIcon = mode === "grid" ? GridIcon : ListIcon;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-label={mode === "grid" ? "Grade" : "Lista"}
                  onClick={() => setViewMode(mode)}
                  className={cn("grid size-8 place-items-center rounded-full transition-colors", viewMode === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  <ModeIcon className="size-4" />
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setLinkOpen(true)}>
            <Link2Icon className="size-4" /> Link
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setFolderOpen(true)} data-guide={GUIDE_ANCHORS.nboxNewFolderButton.id}>
            <FolderIcon className="size-4" /> Pasta
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => setUploadOpen(true)} data-guide={GUIDE_ANCHORS.nboxUploadButton.id}>
            <UploadIcon className="size-4" /> Enviar
          </Button>
        </div>

        {/* Celular: busca em pílula e pastas numa linha que rola. */}
        <div className="shrink-0 space-y-2 px-4 pb-2 md:hidden">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar arquivos" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-full pl-10" />
          </div>
          <div className="scroll-hidden-x -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {selectedFolder && (
              <button
                type="button"
                onClick={() => setSelectedFolderId(selectedFolder.parentId)}
                className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-card px-3 text-sm"
              >
                <ChevronLeftIcon className="size-4" /> Voltar
              </button>
            )}
            {(selectedFolder ? childFolders : rootFolders).map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm"
              >
                {folder.isRestricted ? (
                  <FolderLockIcon className="size-4 text-info" />
                ) : (
                  <FolderIcon className="size-4" style={{ color: folder.color ?? undefined }} />
                )}
                <span className="max-w-32 truncate">{folder.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsFoldersSheetOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-muted px-3 text-sm text-muted-foreground"
            >
              Todas as pastas
            </button>
          </div>
        </div>

        {/* Arquivos */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-[150px] md:px-6 md:py-4">
          {itemsLoading ? (
            <div className={cn("gap-3 md:gap-4", viewMode === "grid" ? NBOX_ITEM_GRID_CLASSNAME : "flex flex-col")}>
              {[1, 2, 3, 4, 5, 6].map((index) => (
                <Skeleton key={index} className={viewMode === "grid" ? "aspect-[4/5] rounded-[20px]" : "h-16 rounded-[18px]"} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-4 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-muted">
                <BoxIcon className="size-5 text-muted-foreground" />
              </span>
              <div>
                <p className="font-semibold">{search ? "Nada com esse nome" : "Esta pasta está vazia"}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{search ? "Tente outro termo de busca." : "Envie arquivos ou guarde links aqui."}</p>
              </div>
              {!search && (
                <Button className="h-11 rounded-full px-6" onClick={() => setUploadOpen(true)}>
                  <UploadIcon className="size-4" /> Enviar arquivos
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className={NBOX_ITEM_GRID_CLASSNAME}>
              {items.map((item) => (
                <ItemCardGrid key={item.id} item={item} onDelete={setDeleteItemId} canPublish={canPublish} onOpen={setPreviewItem} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <ItemRowList key={item.id} item={item} onDelete={setDeleteItemId} canPublish={canPublish} onOpen={setPreviewItem} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Celular: todas as pastas, armazenamento e atalhos do Forge. */}
      <Sheet open={isFoldersSheetOpen} onOpenChange={setIsFoldersSheetOpen}>
        <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col gap-2 rounded-t-[26px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
          <SheetHeader className="p-0 px-1 text-left">
            <SheetTitle>Pastas</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            <NBoxFolderNavigation
              folders={folders}
              rootFolders={rootFolders}
              isLoading={foldersLoading}
              selectedFolderId={selectedFolderId}
              onSelect={selectFolder}
              onDelete={setDeleteFolderId}
              onCreate={() => {
                setIsFoldersSheetOpen(false);
                setFolderOpen(true);
              }}
            />
          </div>
          <div className="-mx-3 border-t">
            <StorageBar />
          </div>
        </SheetContent>
      </Sheet>

      <NBoxItemPreviewSheet
        item={previewItem}
        open={Boolean(previewItem)}
        onOpenChange={(isOpen) => !isOpen && setPreviewItem(null)}
        onDelete={setDeleteItemId}
        canPublish={canPublish}
      />

      {/* ── Modals ── */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={selectedFolderId}
      />
      <NewLinkModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        folderId={selectedFolderId}
      />
      <NewFolderModal
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        parentId={selectedFolderId}
      />

      {/* Delete item confirm */}
      <AlertDialog
        open={!!deleteItemId}
        onOpenChange={(isOpen) => !isOpen && setDeleteItemId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder confirm */}
      <AlertDialog
        open={!!deleteFolderId}
        onOpenChange={(isOpen) => !isOpen && setDeleteFolderId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens dentro da pasta serão movidos para a raiz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
