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

  // Image preview state
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

  /**
   * Eye button handler:
   * - image → open ImagePreviewDialog
   * - anything else → open in new tab
   */
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
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <PaperclipIcon className="size-3.5" />
            Anexos
          </span>
          {!adding && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setAdding(true)}
              disabled={disabled}
            >
              <PlusIcon className="size-3 mr-1" />
              Adicionar
            </Button>
          )}
        </div>

        {attachments.length > 0 && (
          <div className="space-y-1.5">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md border bg-background text-sm group"
              >
                {getFileIcon(att.name)}
                <span className="flex-1 truncate text-xs">{att.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Preview / Open */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    onClick={() => handlePreview(att)}
                    title={
                      isImageFile(att.name)
                        ? "Pré-visualizar imagem"
                        : "Abrir em nova aba"
                    }
                  >
                    <EyeIcon className="size-3" />
                  </Button>

                  {/* Download */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    onClick={() =>
                      handleDownload(useConstructUrl(att.url), att.name)
                    }
                  >
                    <DownloadIcon className="size-3" />
                  </Button>

                  {/* Remove */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-5 text-destructive"
                    onClick={() => handleRemove(att.url)}
                    disabled={disabled}
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
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
