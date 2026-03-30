"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useNBoxFolders,
  useNBoxItems,
  useNBoxStorage,
  useCreateNBoxFolder,
  useDeleteNBoxFolder,
  useCreateNBoxItem,
  useDeleteNBoxItem,
} from "../hooks/use-nbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
  FileSpreadsheetIcon,
  FilePenIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
  GridIcon,
  ListIcon,
  MoreVerticalIcon,
  TrashIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ChevronRightIcon,
  HardDriveIcon,
  FileCheckIcon as FileContractIcon,
  BoxIcon,
} from "lucide-react";
import { toast } from "sonner";
import { NBoxItemType } from "@/generated/prisma/enums";
import Link from "next/link";
import { useConstructUrl } from "@/hooks/use-construct-url";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";

interface NBoxFolder {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
  createdAt: Date | string;
}

interface NBoxItem {
  id: string;
  name: string;
  type: NBoxItemType;
  url: string | null;
  mimeType: string | null;
  size: number | null;
  description: string | null;
  tags: string[];
  folderId: string | null;
  createdAt: Date | string;
  createdBy: { name: string; image: string | null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const PLAN_LABELS: Record<string, string> = {
  earth: "Earth (500 MB)",
  explore: "Explore (2 GB)",
  constellation: "Constellation (10 GB)",
};

// ─── File Icon ────────────────────────────────────────────────────────────────

function FileTypeIcon({ type, mimeType, className }: { type: NBoxItemType; mimeType?: string | null; className?: string }) {
  const cls = cn("shrink-0", className);
  if (type === "IMAGE") return <ImageIcon className={cn(cls, "text-pink-500")} />;
  if (type === "LINK") return <Link2Icon className={cn(cls, "text-blue-500")} />;
  if (type === "CONTRACT") return <FilePenIcon className={cn(cls, "text-emerald-600")} />;
  if (type === "PROPOSAL") return <FileContractIcon className={cn(cls, "text-purple-600")} />;
  if (mimeType?.includes("pdf")) return <FileTextIcon className={cn(cls, "text-red-500")} />;
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel") || mimeType?.includes("csv"))
    return <FileSpreadsheetIcon className={cn(cls, "text-green-600")} />;
  return <FileIcon className={cn(cls, "text-slate-400")} />;
}

// ─── Storage Bar ─────────────────────────────────────────────────────────────

function StorageBar() {
  const { storage } = useNBoxStorage();
  if (!storage) return null;
  const pct = Math.min(100, (storage.usedBytes / storage.limitBytes) * 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="px-3 py-3 border-t space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><HardDriveIcon className="size-3" /> Armazenamento</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {formatBytes(storage.usedBytes)} / {PLAN_LABELS[storage.planSlug] ?? formatBytes(storage.limitBytes)}
      </p>
    </div>
  );
}

// ─── Folder Tree Item ─────────────────────────────────────────────────────────

function FolderTreeItem({
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
          "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors",
          isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon className={cn("size-3 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : <span className="size-3" />}
        {expanded ? (
          <FolderOpenIcon className="size-3.5 shrink-0 text-yellow-500" />
        ) : (
          <FolderIcon className="size-3.5 shrink-0 text-yellow-500" />
        )}
        <span className="flex-1 truncate">{folder.name}</span>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
          onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
        >
          <TrashIcon className="size-3" />
        </button>
      </div>
      {expanded && children.map((child) => (
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

// ─── Item Card (Grid) ─────────────────────────────────────────────────────────

function ItemCardGrid({ item, onDelete }: { item: NBoxItem; onDelete: (id: string) => void }) {
  const s3Url = useConstructUrl(item.url ?? "");
  const isS3Key = !!item.url && !item.url.startsWith("http");
  const resolvedUrl = item.url ? (isS3Key ? s3Url : item.url) : null;

  const isImagePreview =
    (item.type === "IMAGE" || (item.type === "FILE" && item.mimeType?.startsWith("image/"))) &&
    resolvedUrl;

  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all">
      {/* Thumbnail or icon */}
      <div className="h-28 bg-muted/30 flex items-center justify-center overflow-hidden">
        {isImagePreview ? (
          <img src={resolvedUrl!} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <FileTypeIcon type={item.type} mimeType={item.mimeType} className="size-10 opacity-60" />
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-xs font-medium truncate leading-tight">{item.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {item.size ? formatBytes(item.size) : item.type.toLowerCase()}
        </p>
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 bg-background/90 backdrop-blur rounded-lg border border-border shadow-sm">
              <MoreVerticalIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {resolvedUrl && (
              <DropdownMenuItem asChild>
                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" download={item.type !== "LINK"}>
                  {item.type === "LINK" ? <ExternalLinkIcon className="size-3.5" /> : <DownloadIcon className="size-3.5" />}
                  {item.type === "LINK" ? "Abrir link" : "Baixar"}
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(item.id)}>
              <TrashIcon className="size-3.5" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Item Row (List) ──────────────────────────────────────────────────────────

function ItemRowList({ item, onDelete }: { item: NBoxItem; onDelete: (id: string) => void }) {
  const s3Url = useConstructUrl(item.url ?? "");
  const isS3Key = !!item.url && !item.url.startsWith("http");
  const resolvedUrl = item.url ? (isS3Key ? s3Url : item.url) : null;

  const isImagePreview =
    (item.type === "IMAGE" || (item.type === "FILE" && item.mimeType?.startsWith("image/"))) &&
    resolvedUrl;

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
      {/* Thumbnail for images, icon otherwise */}
      <div className="size-9 shrink-0 rounded-lg overflow-hidden bg-muted/40 flex items-center justify-center">
        {isImagePreview ? (
          <img src={resolvedUrl!} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <FileTypeIcon type={item.type} mimeType={item.mimeType} className="size-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{item.size ? formatBytes(item.size) : "—"}</span>
        <span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
            <MoreVerticalIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {resolvedUrl && (
            <DropdownMenuItem asChild>
              <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" download={item.type !== "LINK"}>
                {item.type === "LINK" ? <ExternalLinkIcon className="size-3.5" /> : <DownloadIcon className="size-3.5" />}
                {item.type === "LINK" ? "Abrir link" : "Baixar"}
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(item.id)}>
            <TrashIcon className="size-3.5" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({
  open,
  onClose,
  folderId,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
}) {
  const createItem = useCreateNBoxItem();
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setUploading(true);
    for (const file of acceptedFiles) {
      try {
        // Get presigned URL
        const isImage = file.type.startsWith("image/");
        const res = await fetch("/api/s3/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            isImage,
          }),
        });
        const { presignedUrl, key } = await res.json();
        const url = presignedUrl;

        // Upload to S3
        await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

        // Create item
        const itemType: NBoxItemType = isImage ? NBoxItemType.IMAGE : NBoxItemType.FILE;
        await createItem.mutateAsync({
          folderId,
          type: itemType,
          name: file.name,
          url: key,
          mimeType: file.type,
          size: file.size,
        });
      } catch (e) {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
    setUploading(false);
    onClose();
  }, [createItem, folderId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.*": [],
      "text/*": [],
      "video/*": [],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: uploading,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="size-4" /> Enviar arquivos
          </DialogTitle>
        </DialogHeader>
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            uploading && "opacity-50 cursor-not-allowed",
          )}
        >
          <input {...getInputProps()} />
          <UploadIcon className="size-10 mx-auto mb-3 text-muted-foreground/50" />
          {uploading ? (
            <p className="text-sm text-muted-foreground">Enviando...</p>
          ) : isDragActive ? (
            <p className="text-sm font-medium text-primary">Solte os arquivos aqui</p>
          ) : (
            <>
              <p className="text-sm font-medium">Arraste ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Imagens, PDFs, documentos — até 50 MB</p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Link Modal ───────────────────────────────────────────────────────────

function NewLinkModal({
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
    setName(""); setUrl(""); setDescription("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2Icon className="size-4" /> Adicionar link
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome do link *" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="URL (https://...) *" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || !url.trim() || createItem.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Folder Modal ─────────────────────────────────────────────────────────

function NewFolderModal({
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
  const COLORS = ["#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#EC4899", "#6B7280"];
  const [color, setColor] = useState(COLORS[0]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await createFolder.mutateAsync({ name: name.trim(), parentId: parentId ?? undefined, color });
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderIcon className="size-4" /> Nova pasta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome da pasta *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="flex items-center gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn("size-6 rounded-full transition-all", color === c && "ring-2 ring-offset-2 ring-foreground")}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || createFolder.isPending}>
              Criar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main NBox App Component ──────────────────────────────────────────────────

export function NBoxApp() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  const { folders, isLoading: foldersLoading } = useNBoxFolders();
  const { items, isLoading: itemsLoading } = useNBoxItems({ folderId: selectedFolderId, search: search || undefined });
  const deleteItem = useDeleteNBoxItem();
  const deleteFolder = useDeleteNBoxFolder();

  const rootFolders = folders.filter((f) => !f.parentId);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    await deleteItem.mutateAsync({ itemId: deleteItemId });
    setDeleteItemId(null);
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;
    await deleteFolder.mutateAsync({ folderId: deleteFolderId });
    if (selectedFolderId === deleteFolderId) setSelectedFolderId(null);
    setDeleteFolderId(null);
  };

  return (
    <div className="flex h-svh min-h-0 overflow-hidden">

      {/* ── Left Sidebar ── */}
      <aside className="w-56 shrink-0 flex flex-col border-r bg-sidebar">
        {/* Header */}
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <BoxIcon className="size-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight">N-Box</span>
          </div>
        </div>

        {/* Root */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 space-y-0.5">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
              selectedFolderId === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60",
            )}
          >
            <HardDriveIcon className="size-3.5 shrink-0 text-muted-foreground" />
            Todos os arquivos
          </button>

          <div className="pt-2 pb-1 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Pastas</span>
            <button onClick={() => setFolderOpen(true)} className="hover:text-primary transition-colors">
              <PlusIcon className="size-3" />
            </button>
          </div>

          {foldersLoading ? (
            <div className="space-y-1 px-1">
              {[1,2,3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : rootFolders.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">Nenhuma pasta</p>
          ) : (
            rootFolders.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                depth={0}
                allFolders={folders}
                selectedId={selectedFolderId}
                onSelect={setSelectedFolderId}
                onDelete={setDeleteFolderId}
              />
            ))
          )}

          {/* Forge shortcuts */}
          <div className="pt-3 pb-1 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Forge
          </div>
          <Link href="/forge?tab=contracts" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors">
            <FilePenIcon className="size-3.5 shrink-0 text-emerald-600" /> Contratos
          </Link>
          <Link href="/forge?tab=proposals" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors">
            <FileContractIcon className="size-3.5 shrink-0 text-purple-600" /> Propostas
          </Link>
        </div>

        {/* Storage bar */}
        <StorageBar />
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-background shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
            <button onClick={() => setSelectedFolderId(null)} className="hover:text-foreground transition-colors">
              N-Box
            </button>
            {selectedFolder && (
              <>
                <ChevronRightIcon className="size-3.5 shrink-0" />
                <span className="text-foreground font-medium truncate">{selectedFolder.name}</span>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative w-48 shrink-0">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* View toggle */}
          <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50")}
            >
              <GridIcon className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-muted" : "hover:bg-muted/50")}
            >
              <ListIcon className="size-3.5" />
            </button>
          </div>

          {/* Actions */}
          <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
            <Link2Icon className="size-3.5" /> Link
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFolderOpen(true)}>
            <FolderIcon className="size-3.5" /> Pasta
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <UploadIcon className="size-3.5" /> Enviar
          </Button>
        </div>

        {/* File area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {itemsLoading ? (
            <div className={cn("gap-4", viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "flex flex-col")}>
              {[1,2,3,4,5,6].map((i) => (
                <Skeleton key={i} className={viewMode === "grid" ? "h-40 rounded-xl" : "h-14 rounded-xl"} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <BoxIcon className="size-14 text-muted-foreground/20 mb-4" />
              <p className="text-base font-semibold text-muted-foreground">
                {search ? "Nenhum resultado encontrado" : "Esta pasta está vazia"}
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {search ? "Tente outro termo de busca" : "Envie arquivos ou adicione links"}
              </p>
              {!search && (
                <Button size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
                  <UploadIcon className="size-3.5" /> Enviar arquivos
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => (
                <ItemCardGrid key={item.id} item={item} onDelete={setDeleteItemId} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <ItemRowList key={item.id} item={item} onDelete={setDeleteItemId} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} folderId={selectedFolderId} />
      <NewLinkModal open={linkOpen} onClose={() => setLinkOpen(false)} folderId={selectedFolderId} />
      <NewFolderModal open={folderOpen} onClose={() => setFolderOpen(false)} parentId={selectedFolderId} />

      {/* Delete item confirm */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(o) => !o && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder confirm */}
      <AlertDialog open={!!deleteFolderId} onOpenChange={(o) => !o && setDeleteFolderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens dentro da pasta serão movidos para a raiz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
