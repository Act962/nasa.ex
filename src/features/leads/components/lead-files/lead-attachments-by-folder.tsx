"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArchiveIcon,
  ChevronDownIcon,
  DownloadIcon,
  EyeIcon,
  FileAudioIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Folder,
  FolderOpen,
  ImageIcon,
  MessageSquare,
  PaperclipIcon,
  PlusIcon,
  ClipboardCheck,
  VideoIcon,
  XIcon,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Uploader } from "@/components/file-uploader/uploader";
import { handleDownload } from "@/utils/handle-files";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { ImagePreviewDialog } from "@/features/actions/components/view-modal/image-preview-dialog";
import { orpc } from "@/lib/orpc";
import {
  useCreateLeadFile,
  useDeleteLeadFile,
} from "../../hooks/use-lead-file";

/**
 * "Arquivos" do detalhe do lead — versão unificada que mostra TODOS os
 * anexos do lead organizados em PASTAS:
 *
 *   📁 Arquivos        — uploads manuais dos consultores (LeadFile)
 *   💬 Chat            — mídias trocadas no chat (Message.mediaUrl)
 *   📋 Formulários     — anexos em FormResponses (FileUpload/ImageUpload)
 *      └─ <Nome do form>  — sub-pasta por formulário
 *
 * Cada pasta é colapsável. A pasta "Arquivos" permite adicionar/remover
 * (são uploads manuais). As demais são read-only — o conteúdo é gerado
 * automaticamente pelas outras features.
 */

type Item = {
  id: string;
  url: string;
  name: string;
  mimeType: string | null;
  createdAt: string;
  folder: "Arquivos" | "Chat" | "Formulários";
  subFolder?: string | null;
  source: "manual" | "chat" | "form";
  context?: {
    formId?: string;
    formName?: string;
    formResponseId?: string;
    blockType?: string;
    blockLabel?: string;
    fromMe?: boolean;
    senderName?: string | null;
  };
  uploadedBy?: { name: string | null; image: string | null } | null;
};

const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "tiff", "avif",
]);
function isImageFile(nameOrUrl: string): boolean {
  const ext = nameOrUrl.split(".").pop()?.toLowerCase()?.split("?")[0] ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

function getFileIcon(name: string) {
  if (!name) return <FileIcon className="size-3.5 shrink-0" />;
  const ext = name.split(".").pop()?.toLowerCase()?.split("?")[0];
  switch (ext) {
    case "jpg": case "jpeg": case "png": case "gif": case "svg": case "webp":
      return <ImageIcon className="size-3.5 text-blue-500 shrink-0" />;
    case "pdf": case "txt": case "doc": case "docx":
      return <FileTextIcon className="size-3.5 text-rose-500 shrink-0" />;
    case "xls": case "xlsx": case "csv":
      return <FileSpreadsheetIcon className="size-3.5 text-emerald-500 shrink-0" />;
    case "mp3": case "wav": case "ogg": case "m4a":
      return <FileAudioIcon className="size-3.5 text-amber-500 shrink-0" />;
    case "mp4": case "avi": case "mov": case "webm":
      return <VideoIcon className="size-3.5 text-purple-500 shrink-0" />;
    case "zip": case "rar": case "7z": case "tar": case "gz":
      return <ArchiveIcon className="size-3.5 text-amber-600 shrink-0" />;
    default:
      return <FileIcon className="size-3.5 text-muted-foreground shrink-0" />;
  }
}

function folderIcon(folder: string, open: boolean) {
  if (folder === "Chat") {
    return <MessageSquare className="size-4 text-blue-600" />;
  }
  if (folder === "Formulários") {
    return <ClipboardCheck className="size-4 text-emerald-600" />;
  }
  return open ? (
    <FolderOpen className="size-4 text-amber-600" />
  ) : (
    <Folder className="size-4 text-amber-600" />
  );
}

export function LeadAttachmentsByFolder({ leadId }: { leadId: string }) {
  const { data, isLoading, refetch } = useQuery(
    orpc.leads.listAllAttachments.queryOptions({
      input: { leadId },
    }),
  );
  const createMutation = useCreateLeadFile(leadId);
  const deleteMutation = useDeleteLeadFile(leadId);

  const [adding, setAdding] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    Arquivos: true,
    Chat: false,
    Formulários: true,
  });
  const [openSubFolders, setOpenSubFolders] = useState<Record<string, boolean>>(
    {},
  );
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(
    null,
  );

  const items = (data?.items ?? []) as Item[];
  const disabled = createMutation.isPending || deleteMutation.isPending;

  // Agrupa por pasta + sub-pasta
  const grouped = useMemo(() => {
    const folders: Record<string, { items: Item[]; subFolders: Record<string, Item[]> }> = {
      Arquivos: { items: [], subFolders: {} },
      Chat: { items: [], subFolders: {} },
      Formulários: { items: [], subFolders: {} },
    };
    for (const it of items) {
      const f = folders[it.folder];
      if (!f) continue;
      if (it.subFolder) {
        if (!f.subFolders[it.subFolder]) f.subFolders[it.subFolder] = [];
        f.subFolders[it.subFolder].push(it);
      } else {
        f.items.push(it);
      }
    }
    return folders;
  }, [items]);

  function handleAdd(fileUrl: string, fileName?: string) {
    if (!fileUrl) return;
    const name = fileName ?? "Arquivo";
    const mimeType = fileUrl.split(".").pop() ?? "application/octet-stream";
    createMutation.mutate(
      { fileUrl, mimeType, name, leadId },
      {
        onSuccess: () => {
          setAdding(false);
          refetch();
        },
        onError: () => toast.error("Falha ao salvar arquivo"),
      },
    );
  }

  function handleRemove(item: Item) {
    if (item.source !== "manual") return;
    const fileId = item.id.replace(/^manual:/, "");
    deleteMutation.mutate(
      { leadId, fileId },
      {
        onSuccess: () => refetch(),
        onError: () => toast.error("Falha ao remover arquivo"),
      },
    );
  }

  function openPreview(name: string, url: string) {
    if (isImageFile(name) || isImageFile(url)) {
      setPreview({ src: url, name });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  const totalCount = items.length;

  return (
    <>
      <div className="flex flex-col w-full h-full min-h-0 space-y-3">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PaperclipIcon className="size-3.5" />
            Arquivos
            {totalCount > 0 && (
              <span className="text-foreground/50">({totalCount})</span>
            )}
          </div>
          {!adding && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setAdding(true);
                setOpenFolders((p) => ({ ...p, Arquivos: true }));
              }}
              disabled={disabled}
            >
              <PlusIcon className="size-3 mr-1" />
              Adicionar
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {/* Pasta: Arquivos (manual uploads, com add/remove) */}
          <FolderBlock
            label="Arquivos"
            description="Anexos adicionados manualmente pela equipe"
            open={openFolders.Arquivos}
            onToggle={() =>
              setOpenFolders((p) => ({ ...p, Arquivos: !p.Arquivos }))
            }
            count={grouped.Arquivos.items.length}
          >
            {adding && (
              <div className="border rounded-md p-3 bg-muted/40 space-y-2 mb-3">
                <Uploader fileTypeAccepted="outros" onConfirm={handleAdd} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAdding(false)}
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            )}
            {grouped.Arquivos.items.length === 0 && !adding && (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum arquivo adicionado manualmente.
              </p>
            )}
            {grouped.Arquivos.items.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {grouped.Arquivos.items.map((it) => (
                  <AttachmentTile
                    key={it.id}
                    item={it}
                    onPreview={openPreview}
                    onRemove={() => handleRemove(it)}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </FolderBlock>

          {/* Pasta: Chat (mídias do conversation, read-only) */}
          {grouped.Chat.items.length > 0 && (
            <FolderBlock
              label="Chat"
              description="Mídias trocadas com o lead no chat"
              open={openFolders.Chat}
              onToggle={() =>
                setOpenFolders((p) => ({ ...p, Chat: !p.Chat }))
              }
              count={grouped.Chat.items.length}
              icon={folderIcon("Chat", openFolders.Chat)}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {grouped.Chat.items.map((it) => (
                  <AttachmentTile
                    key={it.id}
                    item={it}
                    onPreview={openPreview}
                  />
                ))}
              </div>
            </FolderBlock>
          )}

          {/* Pasta: Formulários (sub-pastas por nome do form) */}
          {Object.keys(grouped.Formulários.subFolders).length > 0 && (
            <FolderBlock
              label="Formulários"
              description="Anexos em respostas de formulários"
              open={openFolders.Formulários}
              onToggle={() =>
                setOpenFolders((p) => ({
                  ...p,
                  Formulários: !p.Formulários,
                }))
              }
              count={Object.values(grouped.Formulários.subFolders).reduce(
                (a, l) => a + l.length,
                0,
              )}
              icon={folderIcon("Formulários", openFolders.Formulários)}
            >
              <div className="space-y-3">
                {Object.entries(grouped.Formulários.subFolders).map(
                  ([formName, list]) => {
                    const subKey = `Formulários:${formName}`;
                    const subOpen = openSubFolders[subKey] ?? true;
                    return (
                      <div key={subKey} className="ml-2">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSubFolders((p) => ({
                              ...p,
                              [subKey]: !subOpen,
                            }))
                          }
                          className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground py-1"
                        >
                          {subOpen ? (
                            <FolderOpen className="size-3.5 text-emerald-600" />
                          ) : (
                            <Folder className="size-3.5 text-emerald-600" />
                          )}
                          <span>{formName}</span>
                          <span className="text-foreground/50 text-[10px]">
                            ({list.length})
                          </span>
                          <ChevronDownIcon
                            className={`size-3 transition-transform ${
                              subOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {subOpen && (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                            {list.map((it) => (
                              <AttachmentTile
                                key={it.id}
                                item={it}
                                onPreview={openPreview}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </FolderBlock>
          )}
        </div>
      </div>

      <ImagePreviewDialog
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        media={preview ? [{ src: preview.src, alt: preview.name }] : []}
        startIndex={0}
      />
    </>
  );
}

function FolderBlock({
  label,
  description,
  open,
  onToggle,
  count,
  icon,
  children,
}: {
  label: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const renderedIcon = icon ?? folderIcon(label, open);
  return (
    <div className="border border-foreground/10 rounded-md bg-foreground/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-foreground/5 rounded-t-md"
      >
        <div className="flex items-center gap-2">
          {renderedIcon}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-[11px] text-muted-foreground">({count})</span>
        </div>
        <ChevronDownIcon
          className={`size-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {description && open && (
        <p className="text-[11px] text-muted-foreground px-3 -mt-0.5">
          {description}
        </p>
      )}
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

function AttachmentTile({
  item,
  onPreview,
  onRemove,
  disabled,
}: {
  item: Item;
  onPreview: (name: string, url: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const url = useConstructUrl(item.url);
  const isImage = isImageFile(item.name) || isImageFile(item.url);
  const ts = format(new Date(item.createdAt), "dd/MM HH:mm", {
    locale: ptBR,
  });

  if (isImage) {
    return (
      <div className="relative group rounded-md border bg-muted/30 overflow-hidden aspect-video">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={item.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 md:bg-black/60 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
          <div className="flex flex-col">
            <span className="text-white text-xs truncate drop-shadow-md font-medium">
              {item.name}
            </span>
            <span className="text-white/70 text-[10px] truncate drop-shadow-md">
              {ts}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-auto opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="size-6 h-6 w-6 text-xs"
              onClick={() => onPreview(item.name, url)}
              title="Pré-visualizar"
            >
              <EyeIcon className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="size-6 h-6 w-6 text-xs"
              onClick={() => handleDownload(url, item.name)}
              title="Baixar"
            >
              <DownloadIcon className="size-3" />
            </Button>
            {onRemove && (
              <Button
                size="icon"
                variant="destructive"
                className="size-6 h-6 w-6 text-xs ml-auto"
                onClick={onRemove}
                disabled={disabled}
                title="Remover"
              >
                <XIcon className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 gap-2 rounded-md border bg-background text-sm group relative aspect-video">
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <div className="bg-muted p-2.5 rounded-full [&>svg]:size-6">
          {getFileIcon(item.name)}
        </div>
        <span className="text-xs text-center break-all line-clamp-2">
          {item.name}
        </span>
        <span className="text-[10px] text-muted-foreground">{ts}</span>
      </div>
      <div className="flex items-center gap-1 absolute bottom-1.5 left-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon-sm"
          variant="outline"
          className="h-6 w-6"
          onClick={() => onPreview(item.name, url)}
          title="Abrir"
        >
          <ExternalLink className="size-3" />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          className="h-6 w-6"
          onClick={() => handleDownload(url, item.name)}
          title="Baixar"
        >
          <DownloadIcon className="size-3" />
        </Button>
        {onRemove && (
          <Button
            size="icon-sm"
            variant="destructive"
            className="h-6 w-6 ml-auto"
            onClick={onRemove}
            disabled={disabled}
            title="Remover"
          >
            <XIcon className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
