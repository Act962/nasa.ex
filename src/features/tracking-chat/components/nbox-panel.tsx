"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  XIcon,
  PlusIcon,
  FolderIcon,
  ChevronLeftIcon,
  FileIcon,
  ImageIcon,
  LinkIcon,
  FileTextIcon,
  SendIcon,
  ExternalLinkIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  useNBoxFolders,
  useNBoxItems,
  useCreateNBoxFolder,
  useCreateNBoxItem,
} from "@/features/nbox/hooks/use-nbox";
import { NBoxItemType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { Uploader } from "@/components/file-uploader/uploader";

interface NBoxPanelProps {
  onClose: () => void;
  onSendItem: (text: string) => void;
}

// ── Ícone por tipo ────────────────────────────────────────────────────────────
function ItemIcon({ type, className }: { type: NBoxItemType; className?: string }) {
  const cls = cn("size-4 shrink-0", className);
  if (type === NBoxItemType.IMAGE) return <ImageIcon className={cn(cls, "text-blue-500")} />;
  if (type === NBoxItemType.LINK) return <LinkIcon className={cn(cls, "text-green-500")} />;
  if (type === NBoxItemType.CONTRACT) return <FileTextIcon className={cn(cls, "text-purple-500")} />;
  if (type === NBoxItemType.PROPOSAL) return <FileTextIcon className={cn(cls, "text-orange-500")} />;
  return <FileIcon className={cn(cls, "text-muted-foreground")} />;
}

// ── Adicionar link / upload ───────────────────────────────────────────────────
function AddItemForm({
  folderId,
  onDone,
}: {
  folderId: string | null;
  onDone: () => void;
}) {
  const createItem = useCreateNBoxItem();
  const [tab, setTab] = useState<"upload" | "link">("upload");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadedMime, setUploadedMime] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");

  const handleSaveUpload = () => {
    if (!uploadedUrl) return;
    const isImage = uploadedMime.startsWith("image/");
    createItem.mutate(
      {
        folderId,
        type: isImage ? NBoxItemType.IMAGE : NBoxItemType.FILE,
        name: uploadedName || "Arquivo",
        url: uploadedUrl,
        mimeType: uploadedMime || undefined,
      },
      { onSuccess: onDone },
    );
  };

  const handleSaveLink = () => {
    if (!linkUrl.trim()) return;
    createItem.mutate(
      {
        folderId,
        type: NBoxItemType.LINK,
        name: linkName.trim() || linkUrl.slice(0, 50),
        url: linkUrl.trim(),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="px-5 py-4 border-b space-y-3 bg-muted/30 shrink-0">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("upload")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors",
            tab === "upload"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground",
          )}
        >
          <UploadIcon className="size-3" />
          Arquivo
        </button>
        <button
          onClick={() => setTab("link")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors",
            tab === "link"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground",
          )}
        >
          <LinkIcon className="size-3" />
          Link
        </button>
      </div>

      {tab === "upload" ? (
        <div className="space-y-2">
          <div className="border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center gap-1 relative min-h-[60px] text-xs text-muted-foreground">
            {uploadedUrl ? (
              <div className="flex items-center gap-2">
                {uploadedMime.startsWith("image/") ? (
                  <img src={uploadedUrl} className="size-10 rounded object-cover" />
                ) : (
                  <FileIcon className="size-8 text-muted-foreground/50" />
                )}
                <div>
                  <p className="text-xs font-medium text-foreground truncate max-w-[150px]">
                    {uploadedName}
                  </p>
                  <button
                    className="text-[11px] text-destructive"
                    onClick={() => { setUploadedUrl(""); setUploadedName(""); }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <>
                <UploadIcon className="size-5" />
                <span>Clique para enviar um arquivo</span>
              </>
            )}
            {!uploadedUrl && (
              <div className="absolute inset-0 opacity-0">
                <Uploader
                  onUpload={(url, name) => {
                    setUploadedUrl(url);
                    setUploadedName(name || "Arquivo");
                  }}
                  onUploadStart={() => {}}
                  value={uploadedUrl}
                  fileTypeAccepted="outros"
                />
              </div>
            )}
          </div>
          {uploadedUrl && (
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              disabled={createItem.isPending}
              onClick={handleSaveUpload}
            >
              Salvar no N-Box
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="https://..."
            className="h-8 text-xs"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Input
            placeholder="Nome do link (opcional)"
            className="h-8 text-xs"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
          />
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            disabled={!linkUrl.trim() || createItem.isPending}
            onClick={handleSaveLink}
          >
            Salvar link
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function NBoxPanel({ onClose, onSendItem }: NBoxPanelProps) {
  const { folders, isLoading: loadingFolders } = useNBoxFolders();
  const createFolder = useCreateNBoxFolder();

  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const openFolder = folders.find((f) => f.id === openFolderId);

  const { items, isLoading: loadingItems } = useNBoxItems({
    folderId: openFolderId,
    search: search || undefined,
  });

  const handleSend = (item: { name: string; url?: string | null; type: NBoxItemType }) => {
    if (!item.url) return;
    const emoji =
      item.type === NBoxItemType.IMAGE
        ? "🖼️"
        : item.type === NBoxItemType.LINK
        ? "🔗"
        : "📎";
    onSendItem(`${emoji} ${item.name}\n${item.url}`);
    onClose();
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate(
      { name: newFolderName.trim() },
      {
        onSuccess: () => {
          setNewFolderName("");
          setShowNewFolder(false);
        },
      },
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="
          fixed z-50
          w-[90vw] max-w-md
          bg-background border border-border shadow-2xl flex flex-col overflow-hidden
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl
          lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl
        "
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            {openFolderId && (
              <button
                onClick={() => { setOpenFolderId(null); setSearch(""); setShowAddItem(false); }}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
            )}
            <ArchiveIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold truncate max-w-[160px]">
              {openFolder ? openFolder.name : "N-Box"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {openFolderId ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => setShowAddItem((v) => !v)}
              >
                <PlusIcon className="size-3.5" />
                Adicionar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => setShowNewFolder((v) => !v)}
              >
                <PlusIcon className="size-3.5" />
                Nova pasta
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Nova pasta inline */}
        {showNewFolder && !openFolderId && (
          <div className="px-5 py-3 border-b shrink-0 flex gap-2 bg-muted/30">
            <Input
              autoFocus
              placeholder="Nome da pasta…"
              className="h-8 text-sm"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setShowNewFolder(false);
              }}
            />
            <Button
              size="sm"
              className="h-8 px-3 shrink-0"
              disabled={!newFolderName.trim() || createFolder.isPending}
              onClick={handleCreateFolder}
            >
              Criar
            </Button>
          </div>
        )}

        {/* Formulário de adição de item */}
        {showAddItem && openFolderId && (
          <AddItemForm
            folderId={openFolderId}
            onDone={() => setShowAddItem(false)}
          />
        )}

        {/* Busca (dentro de pasta) */}
        {openFolderId && !showAddItem && (
          <div className="px-4 py-2 border-b shrink-0">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar itens…"
                className="h-8 text-xs pl-7"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Vista: pastas ── */}
          {!openFolderId && (
            <>
              {loadingFolders ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="size-5" />
                </div>
              ) : folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                  <ArchiveIcon className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium">N-Box vazio</p>
                  <p className="text-xs text-muted-foreground">
                    Crie pastas para organizar documentos, imagens e links.
                  </p>
                  <Button size="sm" onClick={() => setShowNewFolder(true)}>
                    <PlusIcon className="size-3.5 mr-1.5" />
                    Criar pasta
                  </Button>
                </div>
              ) : (
                <ul className="divide-y">
                  {folders.map((folder) => (
                    <li
                      key={folder.id}
                      className="flex items-center justify-between px-5 py-3 gap-3 hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setOpenFolderId(folder.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderIcon className="size-4 text-yellow-500 shrink-0" />
                        <span className="text-sm truncate">{folder.name}</span>
                      </div>
                      <ChevronLeftIcon className="size-4 text-muted-foreground rotate-180 shrink-0" />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* ── Vista: itens da pasta ── */}
          {openFolderId && (
            <>
              {loadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="size-5" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                  <FileIcon className="size-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    {search ? "Nenhum item encontrado." : "Pasta vazia."}
                  </p>
                  {!search && (
                    <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
                      <PlusIcon className="size-3.5 mr-1.5" />
                      Adicionar item
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="divide-y">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <ItemIcon type={item.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{item.name}</p>
                        {item.url && (
                          <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.url && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => window.open(item.url!, "_blank")}
                          >
                            <ExternalLinkIcon className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2.5 gap-1.5"
                          disabled={!item.url}
                          onClick={() => handleSend(item)}
                        >
                          <SendIcon className="size-3" />
                          Enviar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
