"use client";

import { useState } from "react";
import {
  PaperclipIcon,
  DownloadIcon,
  XIcon,
  PlusIcon,
  EyeIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  FileSpreadsheetIcon,
  FileAudioIcon,
  VideoIcon,
  ArchiveIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Uploader } from "@/components/file-uploader/uploader";
import { handleDownload } from "@/utils/handle-files";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { ImagePreviewDialog } from "./image-preview-dialog";

// ─── helpers ──────────────────────────────────────────────────────────────────

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

function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

const getFileIcon = (fileName: string) => {
  if (!fileName) return <FileIcon className="size-3.5 shrink-0" />;
  const ext = fileName.split(".").pop()?.toLowerCase();

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
};

// ─── types ────────────────────────────────────────────────────────────────────

interface Attachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

interface Props {
  attachments: Attachment[];
  onUpdate: (attachments: Attachment[]) => void;
  onRemove?: (url: string) => void;
  disabled?: boolean;
}

// ─── component ────────────────────────────────────────────────────────────────

export function AttachmentsSection({
  attachments = [],
  onUpdate,
  onRemove,
  disabled,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const [preview, setPreview] = useState<{ src: string; name: string } | null>(
    null,
  );

  const handleAdd = (url: string, name?: string) => {
    if (!url) return;
    onUpdate([...attachments, { url, name: name ?? "Arquivo" }]);
    setAdding(false);
  };

  const handleRemove = (url: string) => {
    if (onRemove) {
      onRemove(url);
    } else {
      onUpdate(attachments.filter((att) => att.url !== url));
    }
  };

  const handlePreview = (att: Attachment) => {
    const resolvedUrl = useConstructUrl(att.url);
    if (isImageFile(att.name)) {
      setPreview({ src: resolvedUrl, name: att.name });
    } else {
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          >
            <PaperclipIcon className="size-3.5" />
            Anexos
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
          <div className="space-y-2">
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {attachments.map((att, i) => {
                  const isImage = isImageFile(att.name);
                  const resolvedUrl = useConstructUrl(att.url);

                  if (isImage) {
                    return (
                      <div
                        key={i}
                        className="relative group rounded-md border bg-muted/30 overflow-hidden aspect-video"
                      >
                        <img
                          src={resolvedUrl}
                          alt={att.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Mobile: slightly dark background always. Desktop: dark background only on hover */}
                        <div className="absolute inset-0 bg-black/40 md:bg-black/60 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                          <span className="text-white text-xs truncate drop-shadow-md font-medium">
                            {att.name}
                          </span>
                          <div className="flex items-center gap-1 mt-auto opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="size-6 h-6 w-6 text-xs transition-colors hover:bg-secondary/80"
                              onClick={() => handlePreview(att)}
                              title="Pré-visualizar imagem"
                            >
                              <EyeIcon className="size-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="size-6 h-6 w-6 text-xs transition-colors hover:bg-secondary/80"
                              onClick={() =>
                                handleDownload(resolvedUrl, att.name)
                              }
                              title="Baixar imagem"
                            >
                              <DownloadIcon className="size-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="size-6 h-6 w-6 text-xs ml-auto transition-colors"
                              onClick={() => handleRemove(att.url)}
                              disabled={disabled}
                              title="Remover imagem"
                            >
                              <XIcon className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-center p-3 gap-2 rounded-md border bg-background text-sm group relative aspect-video"
                    >
                      <div className="flex-1 flex flex-col items-center justify-center gap-2 mb-6">
                        <div className="bg-muted p-2.5 rounded-full [&>svg]:size-6">
                          {getFileIcon(att.name)}
                        </div>
                        <span
                          className="w-full text-center truncate text-xs text-muted-foreground font-medium px-2"
                          title={att.name}
                        >
                          {att.name}
                        </span>
                      </div>

                      {/* Actions wrapper: Always visible on mobile, hidden -> hover on desktop */}
                      <div className="absolute inset-0 bg-background/90 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="size-7"
                          onClick={() => handlePreview(att)}
                          title="Abrir em nova aba"
                        >
                          <EyeIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="size-7"
                          onClick={() => handleDownload(resolvedUrl, att.name)}
                        >
                          <DownloadIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="size-7"
                          onClick={() => handleRemove(att.url)}
                          disabled={disabled}
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {adding && (
              <div className="border rounded-md p-3 bg-muted/40 space-y-2">
                <Uploader
                  value=""
                  onConfirm={handleAdd}
                  fileTypeAccepted="outros"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setAdding(false)}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image preview dialog — rendered outside the list so it can use a portal */}
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
