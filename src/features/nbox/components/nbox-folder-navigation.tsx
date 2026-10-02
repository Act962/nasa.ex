"use client";

import Link from "next/link";
import { FileCheckIcon as FileContractIcon, FilePenIcon, HardDriveIcon, PlusIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FolderTreeItem } from "./nbox-sidebar-parts";
import type { NBoxFolderView as NBoxFolder } from "./nbox-types";

/** Pasta atual e as de cima, da raiz até ela (caminho do topo). */
export function buildFolderPath(folders: NBoxFolder[], folderId: string | null): NBoxFolder[] {
  const path: NBoxFolder[] = [];
  let currentId = folderId;
  while (currentId) {
    const folder = folders.find((candidate) => candidate.id === currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId;
  }
  return path;
}

/** Lista de pastas (lateral do computador e gaveta do celular), com os atalhos do Forge. */
export function NBoxFolderNavigation({
  folders,
  rootFolders,
  isLoading,
  selectedFolderId,
  onSelect,
  onDelete,
  onCreate,
}: {
  folders: NBoxFolder[];
  rootFolders: NBoxFolder[];
  isLoading: boolean;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onDelete: (folderId: string) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors",
          selectedFolderId === null ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/60",
        )}
      >
        <HardDriveIcon className="size-4 shrink-0 text-muted-foreground" />
        Todos os arquivos
      </button>
      <div className="flex items-center justify-between px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <span>Pastas</span>
        <button type="button" onClick={onCreate} aria-label="Nova pasta" className="grid size-8 place-items-center rounded-full hover:bg-muted hover:text-foreground">
          <PlusIcon className="size-4" />
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-1 px-1">
          {[1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-8 w-full rounded-full" />
          ))}
        </div>
      ) : rootFolders.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma pasta ainda</p>
      ) : (
        rootFolders.map((folder) => (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            depth={0}
            allFolders={folders}
            selectedId={selectedFolderId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))
      )}
      <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Forge</div>
      <Link href="/forge?tab=contracts" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-muted/60">
        <FilePenIcon className="size-4 shrink-0 text-success" /> Contratos
      </Link>
      <Link href="/forge?tab=proposals" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-muted/60">
        <FileContractIcon className="size-4 shrink-0 text-chart-4" /> Propostas
      </Link>
    </>
  );
}

