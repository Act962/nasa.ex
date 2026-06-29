"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileVideo, X, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useVideoUploadManager,
  type ActiveUpload,
} from "../stores/use-video-upload-manager";
import { listAllUploads } from "../lib/upload-manager-db";
import { useVideoUpload } from "../hooks/use-video-upload";
import { useVideoUploadRealtime } from "../hooks/use-video-upload-realtime";
import { toast } from "sonner";

/**
 * Widget flutuante no canto inferior-direito. Visível em qualquer página
 * dentro de (platform)/(tracking). Renderiza nada se não há uploads ativos.
 *
 * Ao montar, hidrata o store a partir de uploads persistidos em IndexedDB
 * (sobreviventes de reload da página). Esses entrarão com `file: null` —
 * UI mostra botão "Selecionar arquivo de novo pra retomar".
 *
 * Progresso vem do canal Inngest Realtime (SSE) — funciona em múltiplas abas.
 */
export function UploadManagerDock() {
  const [collapsed, setCollapsed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const uploadsMap = useVideoUploadManager((s) => s.uploads);
  const upsert = useVideoUploadManager((s) => s.upsert);
  const remove = useVideoUploadManager((s) => s.remove);
  const uploads = useMemo(
    () => Array.from(uploadsMap.values()).sort((a, b) => b.startedAt - a.startedAt),
    [uploadsMap],
  );
  const { abort, resumeWithFile } = useVideoUpload();

  // Hidrata da IndexedDB no mount (uma vez)
  useEffect(() => {
    let cancelled = false;
    listAllUploads()
      .then((persisted) => {
        if (cancelled) return;
        for (const u of persisted) {
          if (u.status === "uploading") {
            upsert({ ...u, file: null, status: "paused", progressPct: 0 });
          }
        }
      })
      .catch((err) =>
        console.warn("[UploadManagerDock] failed to load persisted:", err),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (uploads.length === 0) return null;

  // Minimizado: só um chip flutuante com contador
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs font-medium shadow-lg hover:bg-muted/60 transition-colors"
      >
        <FileVideo className="size-3.5 text-violet-500" />
        <span>{uploads.length} upload{uploads.length > 1 ? "s" : ""}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border bg-background shadow-lg">
      <div className="flex items-center justify-between rounded-t-xl border-b bg-muted/40 px-3 py-2 text-sm">
        <div
          className="flex flex-1 cursor-pointer items-center gap-2"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="font-medium">Uploads ({uploads.length})</span>
          {collapsed ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Minimizar"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {!collapsed && (
        <div className="max-h-80 space-y-2 overflow-y-auto p-3">
          {uploads.map((u) => (
            <UploadItem
              key={u.uploadId}
              upload={u}
              onAbort={() => abort(u.uploadId)}
              onResume={(file) => resumeWithFile(u.uploadId, file)}
              onDismiss={() => remove(u.uploadId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UploadItem({
  upload,
  onAbort,
  onResume,
  onDismiss,
}: {
  upload: ActiveUpload;
  onAbort: () => void;
  onResume: (file: File) => void;
  onDismiss: () => void;
}) {
  const remove = useVideoUploadManager((s) => s.remove);

  // Progresso vem do canal Inngest Realtime; fallback para o store local
  // enquanto o primeiro evento SSE ainda não chegou.
  const { progressPct: realtimePct, isCompleted } = useVideoUploadRealtime(
    upload.status === "uploading" ? upload.uploadId : null,
  );

  const progressPct =
    upload.status === "uploading"
      ? Math.max(realtimePct, upload.progressPct)
      : upload.progressPct;

  // Auto-dismiss quando canal sinalizar conclusão
  useEffect(() => {
    if (!isCompleted) return;
    const timer = setTimeout(() => remove(upload.uploadId), 5000);
    return () => clearTimeout(timer);
  }, [isCompleted, upload.uploadId, remove]);

  const statusColor =
    upload.status === "completed" || isCompleted
      ? "bg-emerald-500"
      : upload.status === "failed" || upload.status === "aborted"
        ? "bg-destructive"
        : upload.status === "paused"
          ? "bg-amber-500"
          : "bg-violet-500";

  return (
    <div className="rounded-lg border bg-card p-2 text-xs">
      <div className="flex items-center gap-2">
        <FileVideo className="size-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-medium" title={upload.filename}>
          {upload.filename}
        </span>
        <span className="text-muted-foreground">{progressPct}%</span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {upload.lessonTitle}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", statusColor)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {upload.status === "paused" && (
          <ResumeButton onResume={onResume} filename={upload.filename} />
        )}
        {upload.status === "uploading" && !isCompleted && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={onAbort}
          >
            <X className="size-3" />
            Cancelar
          </Button>
        )}
        {(upload.status === "completed" ||
          upload.status === "aborted" ||
          upload.status === "failed" ||
          isCompleted) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={onDismiss}
          >
            <X className="size-3" />
            Fechar
          </Button>
        )}
      </div>
    </div>
  );
}

/** Botão "Retomar" — abre file picker e valida que é o mesmo arquivo. */
function ResumeButton({
  onResume,
  filename,
}: {
  onResume: (file: File) => void;
  filename: string;
}) {
  return (
    <label className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-2 text-[10px] hover:bg-muted">
      <RotateCw className="size-3" />
      Retomar
      <input
        type="file"
        className="hidden"
        accept="video/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.name !== filename) {
              toast.error(`Selecione o arquivo "${filename}" pra retomar.`);
              return;
            }
            onResume(f);
          }
          e.target.value = "";
        }}
      />
    </label>
  );
}
