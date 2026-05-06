"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { BookOpen, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — o endpoint /api/s3/upload limita a 20MB
const ACCEPTED: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/epub+zip": [".epub"],
};

export interface EbookData {
  ebookFileKey: string | null;
  ebookFileName: string | null;
  ebookFileSize: number | null;
  ebookMimeType: string | null;
  ebookPageCount: number | null;
}

interface Props {
  value: EbookData;
  onChange: (next: EbookData) => void;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EbookUploadSection({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      try {
        const presigned = await fetch("/api/s3/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            isImage: false,
          }),
        });
        if (!presigned.ok) {
          const data = await presigned.json().catch(() => ({}));
          throw new Error(data?.error ?? "Falha ao gerar URL de upload");
        }
        const { presignedUrl, key } = await presigned.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 204) resolve();
            else reject(new Error("Upload falhou"));
          };
          xhr.onerror = () => reject(new Error("Upload falhou"));
          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        onChange({
          ebookFileKey: key,
          ebookFileName: file.name,
          ebookFileSize: file.size,
          ebookMimeType: file.type,
          ebookPageCount: value.ebookPageCount,
        });
        toast.success("eBook enviado!");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha no upload");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [onChange, value.ebookPageCount],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) upload(accepted[0]);
    },
    [upload],
  );

  const onReject = (rej: FileRejection[]) => {
    const tooLarge = rej.find((r) => r.errors[0]?.code === "file-too-large");
    const wrongType = rej.find((r) => r.errors[0]?.code === "file-invalid-type");
    if (tooLarge) toast.error("Arquivo muito grande (limite 20 MB).");
    else if (wrongType) toast.error("Apenas PDF ou EPUB são aceitos.");
    else toast.error("Arquivo inválido.");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: onReject,
    accept: ACCEPTED,
    multiple: false,
    maxFiles: 1,
    maxSize: MAX_BYTES,
    disabled: uploading || !!value.ebookFileKey,
  });

  function clear() {
    onChange({
      ebookFileKey: null,
      ebookFileName: null,
      ebookFileSize: null,
      ebookMimeType: null,
      ebookPageCount: value.ebookPageCount,
    });
  }

  const hasFile = !!value.ebookFileKey;

  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-900/10">
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
        <BookOpen className="size-4" />
        <h3 className="text-sm font-semibold">Arquivo do eBook</h3>
      </div>

      {!hasFile ? (
        <Card
          {...getRootProps()}
          className={cn(
            "h-32 border-2 border-dashed transition-colors",
            isDragActive
              ? "border-amber-500 bg-amber-100/40 dark:bg-amber-800/20"
              : "border-amber-300/70 hover:border-amber-500",
            uploading && "opacity-60",
          )}
        >
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <input {...getInputProps()} />
            {uploading ? (
              <>
                <Loader2 className="size-6 animate-spin text-amber-600" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Enviando… {progress}%
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="size-6 text-amber-600" />
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Arraste o PDF/EPUB aqui ou clique pra escolher
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Limite 20 MB. Aceita .pdf e .epub.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-white p-3 dark:border-amber-700 dark:bg-amber-950/50">
          <div className="flex items-center gap-3 text-sm">
            <FileText className="size-5 text-amber-600" />
            <div>
              <p className="font-medium">{value.ebookFileName}</p>
              <p className="text-xs text-muted-foreground">
                {value.ebookFileSize ? formatBytes(value.ebookFileSize) : ""}{" "}
                · {value.ebookMimeType ?? "arquivo"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Remover
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ebookPageCount">Número de páginas (opcional)</Label>
        <Input
          id="ebookPageCount"
          type="number"
          min={0}
          value={value.ebookPageCount?.toString() ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              ebookPageCount: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="Ex.: 120"
        />
      </div>
    </div>
  );
}
