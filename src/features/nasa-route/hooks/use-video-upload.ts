"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { useVideoUploadManager } from "../stores/use-video-upload-manager";
import {
  saveUpload,
  deleteUpload,
  loadUpload,
  type PersistedUpload,
} from "../lib/upload-manager-db";

interface StartUploadOpts {
  file: File;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  costStars: number;
}

const PARALLEL_WORKERS = 4;
const PART_RETRY_MAX = 3;
const PART_RETRY_BASE_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function putPart(url: string, chunk: Blob): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < PART_RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", body: chunk });
      if (!res.ok) throw new Error(`PUT falhou: HTTP ${res.status}`);
      const etag = res.headers.get("ETag") ?? res.headers.get("etag");
      if (!etag) throw new Error("R2 não retornou ETag");
      return etag.replace(/"/g, "");
    } catch (err) {
      lastErr = err;
      if (attempt < PART_RETRY_MAX - 1) {
        await sleep(PART_RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha ao enviar part");
}

export function useVideoUpload() {
  const qc = useQueryClient();
  const store = useVideoUploadManager();

  const startAndRun = useCallback(
    async (opts: StartUploadOpts) => {
      const { file, courseId, lessonId, lessonTitle } = opts;

      let started: {
        uploadId: string;
        multipartUploadId: string;
        fileKey: string;
        totalParts: number;
        partSize: number;
        costStars: number;
        presignedUrls: string[];
      };

      try {
        started = await orpc.nasaRoute.creatorStartVideoUpload.call({
          courseId,
          lessonId,
          sizeBytes: file.size,
          mimeType: file.type as
            | "video/mp4"
            | "video/quicktime"
            | "video/webm"
            | "video/x-matroska",
          filename: file.name,
        });
      } catch (err: unknown) {
        const e = err as { data?: { code?: string; needed?: number; balance?: number }; message?: string };
        if (e?.data?.code === "INSUFFICIENT_STARS") {
          toast.error(
            `Saldo insuficiente. Necessário: ${e.data.needed} ★ (saldo: ${e.data.balance} ★)`,
          );
        } else {
          toast.error(e?.message ?? "Não foi possível iniciar o upload.");
        }
        throw err;
      }

      const persisted: PersistedUpload = {
        uploadId: started.uploadId,
        multipartUploadId: started.multipartUploadId,
        fileKey: started.fileKey,
        courseId,
        lessonId,
        lessonTitle,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        totalParts: started.totalParts,
        partSize: started.partSize,
        costStars: started.costStars,
        completedParts: [],
        status: "uploading",
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      store.upsert({ ...persisted, file, progressPct: 0 });
      await saveUpload(persisted);

      try {
        await runUploadLoop(started.uploadId, file, started.presignedUrls);
        toast.success(`Upload de "${file.name}" concluído!`);
      } catch (err: unknown) {
        const e = err as { message?: string };
        toast.error(e?.message ?? "Falha no upload.");
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runUploadLoop = useCallback(
    async (uploadId: string, file: File, presignedUrls: string[]) => {
      const snap = useVideoUploadManager.getState().uploads.get(uploadId);
      if (!snap) throw new Error("Upload não encontrado no store");

      const { totalParts, partSize, completedParts } = snap;
      const completedSet = new Set(completedParts.map((p) => p.partNumber));

      // Fila de parts pendentes
      const queue = Array.from({ length: totalParts }, (_, i) => i + 1).filter(
        (n) => !completedSet.has(n),
      );

      async function worker() {
        while (queue.length > 0) {
          const partNumber = queue.shift();
          if (!partNumber) break;

          const current = useVideoUploadManager.getState().uploads.get(uploadId);
          if (!current || current.status !== "uploading") return;

          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          const url = presignedUrls[partNumber - 1];
          const etag = await putPart(url, chunk);

          useVideoUploadManager.getState().addPart(uploadId, partNumber, etag);

          // Calcula progresso atualizado e reporta ao servidor (fire & forget)
          const updated = useVideoUploadManager.getState().uploads.get(uploadId);
          if (updated) {
            const completedCount = updated.completedParts.length;
            const progressPct = Math.round((completedCount / totalParts) * 100);

            void orpc.nasaRoute.creatorReportUploadPart.call({
              uploadId,
              partNumber,
              etag,
              progressPct,
              completedParts: completedCount,
              totalParts,
            });

            // IndexedDB — mantido para resume após reload de página
            const { file: _f, progressPct: _p, ...rest } = updated;
            void _f;
            void _p;
            void saveUpload(rest);
          }
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(PARALLEL_WORKERS, queue.length || 1) },
          () => worker(),
        ),
      );

      const final = useVideoUploadManager.getState().uploads.get(uploadId);
      if (!final) return;

      await orpc.nasaRoute.creatorCompleteVideoUpload.call({
        uploadId,
        parts: final.completedParts,
      });

      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({
          input: { courseId: final.courseId },
        }),
      });

      useVideoUploadManager.getState().patch(uploadId, {
        status: "completed",
        lastUpdatedAt: Date.now(),
      });
      await deleteUpload(uploadId);

      setTimeout(() => {
        useVideoUploadManager.getState().remove(uploadId);
      }, 5000);
    },
    [qc],
  );

  /** Resume após reload: URLs expiradas — busca uma a uma (caminho de exceção). */
  const resumeWithFile = useCallback(
    async (uploadId: string, file: File) => {
      const persisted = await loadUpload(uploadId);
      if (!persisted) {
        toast.error("Upload expirado.");
        return;
      }
      if (persisted.sizeBytes !== file.size || persisted.filename !== file.name) {
        toast.error("Arquivo diferente do upload original.");
        return;
      }

      useVideoUploadManager
        .getState()
        .upsert({ ...persisted, file, progressPct: 0 });

      // No resume as URLs do start já expiraram — busca individualmente
      const snap = useVideoUploadManager.getState().uploads.get(uploadId)!;
      const completedSet = new Set(snap.completedParts.map((p) => p.partNumber));
      const pending = Array.from(
        { length: snap.totalParts },
        (_, i) => i + 1,
      ).filter((n) => !completedSet.has(n));

      const freshUrls: string[] = new Array(snap.totalParts).fill("");
      for (const partNumber of pending) {
        const { url } = await orpc.nasaRoute.creatorGetUploadPartUrl.call({
          uploadId,
          partNumber,
        });
        freshUrls[partNumber - 1] = url;
      }

      await runUploadLoop(uploadId, file, freshUrls);
    },
    [runUploadLoop],
  );

  const abort = useCallback(async (uploadId: string) => {
    try {
      await orpc.nasaRoute.creatorAbortVideoUpload.call({ uploadId });
    } catch (err) {
      console.warn("[useVideoUpload] abort falhou (ignorado):", err);
    }
    useVideoUploadManager.getState().patch(uploadId, { status: "aborted" });
    await deleteUpload(uploadId);
    useVideoUploadManager.getState().remove(uploadId);
  }, []);

  return { startAndRun, resumeWithFile, abort };
}
