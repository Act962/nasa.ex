"use client";

import { useState } from "react";
import { ArchiveIcon, XIcon, PlusIcon, FolderIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useNBoxFolders,
  useCreateNBoxFolder,
  useCreateNBoxItem,
} from "@/features/nbox/hooks/use-nbox";
import { NBoxItemType } from "@/generated/prisma/enums";

interface SaveToNBoxPanelProps {
  onClose: () => void;
  /** Dados da mensagem a salvar */
  message: {
    body?: string | null;
    mediaUrl?: string | null;
    mimetype?: string | null;
    fileName?: string | null;
  };
}

function detectType(message: SaveToNBoxPanelProps["message"]): NBoxItemType {
  if (message.mimetype?.startsWith("image/")) return NBoxItemType.IMAGE;
  if (
    message.mimetype?.startsWith("application/") ||
    message.mimetype?.startsWith("text/") ||
    message.mimetype?.startsWith("video/")
  )
    return NBoxItemType.FILE;
  // Se for texto com URL
  if (message.body && /https?:\/\//.test(message.body)) return NBoxItemType.LINK;
  return NBoxItemType.FILE;
}

function buildUrl(message: SaveToNBoxPanelProps["message"]): string {
  if (message.mediaUrl) return message.mediaUrl;
  // Extrai URL do texto
  const match = message.body?.match(/https?:\/\/\S+/);
  return match?.[0] ?? "";
}

function buildName(message: SaveToNBoxPanelProps["message"]): string {
  if (message.fileName) return message.fileName;
  if (message.mimetype?.startsWith("image/")) return `Imagem ${new Date().toLocaleDateString("pt-BR")}`;
  if (message.mediaUrl) return "Arquivo do chat";
  const body = message.body?.slice(0, 60) ?? "Mensagem";
  return body.length < (message.body?.length ?? 0) ? body + "…" : body;
}

export function SaveToNBoxPanel({ onClose, message }: SaveToNBoxPanelProps) {
  const { folders, isLoading } = useNBoxFolders();
  const createFolder = useCreateNBoxFolder();
  const createItem = useCreateNBoxItem();

  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [savedFolderId, setSavedFolderId] = useState<string | null>(null);

  const handleSave = (folderId: string | null) => {
    const type = detectType(message);
    const url = buildUrl(message);
    const name = buildName(message);

    createItem.mutate(
      {
        folderId,
        type,
        name,
        url: url || undefined,
        mimeType: message.mimetype ?? undefined,
        description: message.body?.slice(0, 500) ?? undefined,
      },
      {
        onSuccess: () => {
          setSavedFolderId(folderId ?? "root");
          setTimeout(onClose, 1200);
        },
      },
    );
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
          w-[90vw] max-w-sm
          bg-background border border-border shadow-2xl flex flex-col overflow-hidden
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl
          lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl
        "
        style={{ maxHeight: "70vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <ArchiveIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Salvar em N-Box</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setShowNewFolder(true)}
              disabled={showNewFolder}
            >
              <PlusIcon className="size-3.5" />
              Nova Pasta
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Nova pasta inline */}
        {showNewFolder && (
          <div className="px-5 py-3 border-b shrink-0 flex gap-2">
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
              className="h-8 px-3"
              disabled={!newFolderName.trim() || createFolder.isPending}
              onClick={handleCreateFolder}
            >
              {createFolder.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : "Criar"}
            </Button>
          </div>
        )}

        {/* Lista de pastas */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="size-5" />
            </div>
          ) : folders.length === 0 && !showNewFolder ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-6">
              <FolderIcon className="size-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma pasta criada ainda.</p>
              <Button size="sm" onClick={() => setShowNewFolder(true)}>
                <PlusIcon className="size-3.5 mr-1.5" />
                Criar pasta
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {folders.map((folder) => {
                const saved = savedFolderId === folder.id;
                const saving = createItem.isPending && !savedFolderId;
                return (
                  <li
                    key={folder.id}
                    className="flex items-center justify-between px-5 py-3 gap-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderIcon className="size-4 text-yellow-500 shrink-0" />
                      <span className="text-sm truncate">{folder.name}</span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3 shrink-0"
                      variant={saved ? "outline" : "default"}
                      disabled={saving || !!savedFolderId}
                      onClick={() => handleSave(folder.id)}
                    >
                      {saved ? (
                        <><CheckIcon className="size-3 mr-1" />Salvo!</>
                      ) : saving ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        "salvar aqui"
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
