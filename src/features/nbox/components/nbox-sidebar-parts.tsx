"use client";

import { useState } from "react";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderLockIcon,
  FolderOpenIcon,
  HardDriveIcon,
  TrashIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNBoxStorage } from "../hooks/use-nbox";
import { formatBytes } from "./nbox-file-type-icon";
import type { NBoxFolderView as NBoxFolder } from "./nbox-types";

/** Peças da lateral do N-Box: barra de armazenamento e árvore de pastas. */

const PLAN_LABELS: Record<string, string> = {
  earth: "Earth (500 MB)",
  explore: "Explore (2 GB)",
  constellation: "Constellation (10 GB)",
};

// ─── Storage Bar ─────────────────────────────────────────────────────────────

export function StorageBar() {
  const { storage } = useNBoxStorage();
  if (!storage) return null;
  const pct = Math.min(100, (storage.usedBytes / storage.limitBytes) * 100);
  const color =
    pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary";
  return (
    <div className="px-3 py-3 border-t space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <HardDriveIcon className="size-3" /> Armazenamento
        </span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {formatBytes(storage.usedBytes)} /{" "}
        {PLAN_LABELS[storage.planSlug] ?? formatBytes(storage.limitBytes)}
      </p>
    </div>
  );
}

// ─── Folder Tree Item ─────────────────────────────────────────────────────────

export function FolderTreeItem({
  folder,
  depth,
  allFolders,
  selectedId,
  onSelect,
  onDelete,
}: {
  folder: NBoxFolder;
  depth: number;
  allFolders: NBoxFolder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <div
        className={cn(
          "group flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors",
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted/60",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            aria-label={expanded ? "Recolher" : "Abrir subpastas"}
            className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRightIcon
              className={cn(
                "size-3 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="size-7" />
        )}
        {folder.isRestricted ? (
          <FolderLockIcon className="size-3.5 shrink-0 text-info" />
        ) : expanded ? (
          <FolderOpenIcon className="size-3.5 shrink-0 text-warning" />
        ) : (
          <FolderIcon className="size-3.5 shrink-0 text-warning" />
        )}
        <span className="flex-1 truncate">{folder.name}</span>
        {!folder.systemKey && (
        <button
          type="button"
          aria-label="Excluir pasta"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(folder.id);
          }}
        >
          <TrashIcon className="size-3.5" />
        </button>
        )}
      </div>
      {expanded &&
        children.map((child) => (
          <FolderTreeItem
            key={child.id}
            folder={child}
            depth={depth + 1}
            allFolders={allFolders}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

