"use client";

import { useState, useRef, useMemo } from "react";
import { Upload, FileVideo, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideoUpload } from "@/features/nasa-route/hooks/use-video-upload";
import {
  VIDEO_UPLOAD_ALLOWED_MIMES,
  VIDEO_UPLOAD_MAX_BYTES,
  formatFileSize,
} from "@/features/nasa-route/lib/video-storage-pricing";
import { VideoUploadCostModal } from "./video-upload-cost-modal";
import { useVideoUploadManager } from "@/features/nasa-route/stores/use-video-upload-manager";
import { r2NasaRouteVideoUrl } from "@/features/nasa-route/lib/video-storage-url";

interface Props {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  /** Vídeo já hospedado (após upload concluído) — mostra preview e botão "Substituir". */
  currentVideoFileKey: string | null;
  currentVideoFileSize: number | null;
}

const ACCEPT_ATTR = VIDEO_UPLOAD_ALLOWED_MIMES.join(",");

export function LessonFormVideoUploader({
  courseId,
  lessonId,
  lessonTitle,
  currentVideoFileKey,
  currentVideoFileSize,
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startAndRun } = useVideoUpload();

  // Subscreve só o Map (ref estável) e deriva o upload ativo via useMemo —
  // evita "getServerSnapshot should be cached" no useSyncExternalStore.
  const uploadsMap = useVideoUploadManager((s) => s.uploads);
  const activeUpload = useMemo(
    () =>
      Array.from(uploadsMap.values()).find(
        (u) => u.lessonId === lessonId && u.status === "uploading",
      ),
    [uploadsMap, lessonId],
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
      setError(
        `Arquivo muito grande (${formatFileSize(file.size)}). Limite: 2 GB.`,
      );
      e.target.value = "";
      return;
    }
    if (!(VIDEO_UPLOAD_ALLOWED_MIMES as readonly string[]).includes(file.type)) {
      setError(
        `Formato não suportado (${file.type || "desconhecido"}). Use MP4, MOV, WebM ou MKV.`,
      );
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setShowCostModal(true);
  }

  function clearSelection() {
    setSelectedFile(null);
    setShowCostModal(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleConfirmUpload() {
    if (!selectedFile) return;
    setShowCostModal(false);
    try {
      await startAndRun({
        file: selectedFile,
        courseId,
        lessonId,
        lessonTitle,
        costStars: 0, // recalculado server-side; valor aqui é só pra interface
      });
    } catch {
      // Toast já mostrado pelo hook.
    } finally {
      clearSelection();
    }
  }

  // ── Render: vídeo já upado ────────────────────────────────────
  if (currentVideoFileKey && !activeUpload && !selectedFile) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <CheckCircle2 className="mt-0.5 size-5 flex-shrink-0 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              Vídeo hospedado no R2
            </p>
            {currentVideoFileSize && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {formatFileSize(currentVideoFileSize)}
              </p>
            )}
            <a
              href={r2NasaRouteVideoUrl(currentVideoFileKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-300"
            >
              Abrir vídeo
            </a>
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4 mr-1.5" />
            Substituir vídeo (vai cobrar STARs de novo)
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: upload em andamento ───────────────────────────────
  if (activeUpload) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2">
          <FileVideo className="size-4 text-violet-600" />
          <span className="flex-1 truncate font-medium">{activeUpload.filename}</span>
          <span className="text-xs text-muted-foreground">
            {activeUpload.progressPct}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-violet-500 transition-all"
            style={{ width: `${activeUpload.progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Você pode fechar este formulário e continuar usando o app — o upload continua no dock
          (canto inferior direito).
        </p>
      </div>
    );
  }

  // ── Render: estado inicial / seleção ──────────────────────────
  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 transition-colors hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10"
      >
        <Upload className="size-6 text-muted-foreground" />
        <span className="mt-2 text-sm font-medium">Selecionar vídeo</span>
        <span className="text-xs text-muted-foreground">
          MP4, MOV, WebM ou MKV · até 2 GB
        </span>
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <X className="mt-0.5 size-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Vídeo armazenado no nosso storage com cobrança única em STARs (calculada
        pelo tamanho). O aluno reproduz direto do nosso CDN.
      </p>

      {selectedFile && (
        <VideoUploadCostModal
          open={showCostModal}
          onClose={clearSelection}
          onConfirm={handleConfirmUpload}
          courseId={courseId}
          file={selectedFile}
        />
      )}
    </div>
  );
}
