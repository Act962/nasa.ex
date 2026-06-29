"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  ChevronDownIcon,
  DownloadIcon,
  EyeIcon,
  FileAudioIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  PlusIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Uploader } from "@/components/file-uploader/uploader";
import { handleDownload } from "@/utils/handle-files";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { ImagePreviewDialog } from "@/features/actions/components/view-modal/image-preview-dialog";
import {
  useCreateLeadFile,
  useDeleteLeadFile,
  useLeadFiles,
} from "../../hooks/use-lead-file";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "svg",
  "webp",
  "bmp",
  "tiff",
  "avif",
]);

function isImageFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

function getFileIcon(name: string) {
  if (!name) return <FileIcon className="size-3.5 shrink-0" />;
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
    case "webp":
      return <ImageIcon className="size-3.5 text-blue-500 shrink-0" />;
    case "pdf":
    case "txt":
    case "doc":
    case "docx":
      return <FileTextIcon className="size-3.5 text-rose-500 shrink-0" />;
    case "xls":
    case "xlsx":
    case "csv":
      return (
        <FileSpreadsheetIcon className="size-3.5 text-emerald-500 shrink-0" />
      );
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
      return <FileAudioIcon className="size-3.5 text-amber-500 shrink-0" />;
    case "mp4":
    case "avi":
    case "mov":
    case "webm":
      return <VideoIcon className="size-3.5 text-purple-500 shrink-0" />;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return <ArchiveIcon className="size-3.5 text-amber-600 shrink-0" />;
    default:
      return <FileIcon className="size-3.5 text-muted-foreground shrink-0" />;
  }
}

export function LeadFiles({ leadId }: { leadId: string }) {
  const { files, isLoading } = useLeadFiles(leadId);
  const createMutation = useCreateLeadFile(leadId);
  const deleteMutation = useDeleteLeadFile(leadId);

  const [adding, setAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(
    null,
  );

  const disabled = createMutation.isPending || deleteMutation.isPending;

  function handleAdd(fileUrl: string, fileName?: string) {
    if (!fileUrl) return;
    const name = fileName ?? "Arquivo";
    const mimeType = fileUrl.split(".").pop() ?? "application/octet-stream";
    createMutation.mutate(
      { fileUrl, mimeType, name, leadId },
      {
        onSuccess: () => setAdding(false),
        onError: () => toast.error("Falha ao salvar arquivo"),
      },
    );
  }

  function handleRemove(fileId: string) {
    deleteMutation.mutate(
      { leadId, fileId },
      {
        onError: () => toast.error("Falha ao remover arquivo"),
      },
    );
  }

  function openPreview(name: string, url: string) {
    if (isImageFile(name)) {
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

  return (
    <>
      <div className="flex flex-col w-full h-full min-h-0 space-y-3">
        <div className="flex items-center justify-between shrink-0">
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          >
            <PaperclipIcon className="size-3.5" />
            Arquivos
            {files && files.length > 0 && (
              <span className="text-foreground/50">({files.length})</span>
            )}
            <ChevronDownIcon
              className={`size-3.5 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
          {!adding && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setAdding(true);
                setIsExpanded(true);
              }}
              disabled={disabled}
            >
              <PlusIcon className="size-3 mr-1" />
              Adicionar
            </Button>
          )}
        </div>

        {isExpanded && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
            {files && files.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {files.map((file) => (
                  <FileTile
                    key={file.id}
                    file={file}
                    disabled={disabled}
                    onPreview={openPreview}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}

            {adding && (
              <div className="border rounded-md p-3 bg-muted/40 space-y-2">
                <Uploader
                  fileTypeAccepted="outros"
                  onConfirm={handleAdd}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setAdding(false)}
                  disabled={disabled}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {!adding && (!files || files.length === 0) && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum arquivo</EmptyTitle>
                  <EmptyDescription>
                    Anexe imagens e documentos relacionados a este lead.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        )}
      </div>

      <ImagePreviewDialog
        open={!!preview}
        src={preview?.src ?? ""}
        fileName={preview?.name}
        onClose={() => setPreview(null)}
        onDownload={
          preview ? () => handleDownload(preview.src, preview.name) : undefined
        }
      />
    </>
  );
}

type FileTileProps = {
  file: {
    id: string;
    name: string;
    fileUrl: string;
    mimeType: string;
  };
  disabled?: boolean;
  onPreview: (name: string, url: string) => void;
  onRemove: (fileId: string) => void;
};

function FileTile({ file, disabled, onPreview, onRemove }: FileTileProps) {
  const url = useConstructUrl(file.fileUrl);
  const isImage = isImageFile(file.name);

  if (isImage) {
    return (
      <div className="relative group rounded-md border bg-muted/30 overflow-hidden aspect-video">
        <img
          src={url}
          alt={file.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 md:bg-black/60 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
          <span className="text-white text-xs truncate drop-shadow-md font-medium">
            {file.name}
          </span>
          <div className="flex items-center gap-1 mt-auto opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="size-6 h-6 w-6 text-xs hover:bg-secondary/80"
              onClick={() => onPreview(file.name, url)}
              title="Pré-visualizar"
            >
              <EyeIcon className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="size-6 h-6 w-6 text-xs hover:bg-secondary/80"
              onClick={() => handleDownload(url, file.name)}
              title="Baixar"
            >
              <DownloadIcon className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="size-6 h-6 w-6 text-xs ml-auto"
              onClick={() => onRemove(file.id)}
              disabled={disabled}
              title="Remover"
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 gap-2 rounded-md border bg-background text-sm group relative aspect-video">
      <div className="flex-1 flex flex-col items-center justify-center gap-2 mb-6">
        <div className="bg-muted p-2.5 rounded-full [&>svg]:size-6">
          {getFileIcon(file.name)}
        </div>
        <span
          className="w-full text-center truncate text-xs text-muted-foreground font-medium px-2"
          title={file.name}
        >
          {file.name}
        </span>
      </div>

      <div className="absolute inset-0 bg-background/90 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
        <Button
          size="icon"
          variant="secondary"
          className="size-7"
          onClick={() => onPreview(file.name, url)}
          title="Abrir"
        >
          <EyeIcon className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="size-7"
          onClick={() => handleDownload(url, file.name)}
          title="Baixar"
        >
          <DownloadIcon className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          className="size-7"
          onClick={() => onRemove(file.id)}
          disabled={disabled}
          title="Remover"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
