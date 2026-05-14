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
  /** Custo já confirmado pelo modal de quote — não recalcula aqui. */
  costStars: number;
}

const PART_RETRY_MAX = 3;
const PART_RETRY_BASE_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * PUT chunk direto pro R2 via presigned URL, com retry exponencial.
 * Captura ETag do header de resposta (R2 retorna com aspas, normalizamos).
 */
async function putPart(url: string, chunk: Blob): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < PART_RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", body: chunk });
      if (!res.ok) {
        throw new Error(`PUT falhou: HTTP ${res.status}`);
      }
      const etag = res.headers.get("ETag") ?? res.headers.get("etag");
      if (!etag) {
        throw new Error("R2 não retornou ETag");
      }
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

/**
 * Hook que orquestra o ciclo completo de um upload de vídeo:
 *   start (server) → loop de parts (client→R2) → complete (server)
 *
 * Estado vive no Zustand store global (`useVideoUploadManager`) pra ser
 * visível pelo dock flutuante. Progresso é persistido em IndexedDB a cada
 * chunk concluído pra retomar após reload.
 */
export function useVideoUpload() {
  const qc = useQueryClient();
  const store = useVideoUploadManager();

  const startAndRun = useCallback(
    async (opts: StartUploadOpts) => {
      const { file, courseId, lessonId, lessonTitle } = opts;

      // 1. Inicia upload no servidor (debita STARs + cria multipart)
      let started: {
        uploadId: string;
        multipartUploadId: string;
        fileKey: string;
        totalParts: number;
        partSize: number;
        costStars: number;
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
      } catch (err: any) {
        if (err?.data?.code === "INSUFFICIENT_STARS") {
          toast.error(
            `Saldo insuficiente. Necessário: ${err.data.needed} ★ (saldo: ${err.data.balance} ★)`,
          );
        } else {
          toast.error(err?.message ?? "Não foi possível iniciar o upload.");
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
        await runUploadLoop(started.uploadId, file);
        toast.success(`Upload de "${file.name}" concluído!`);
      } catch (err: any) {
        toast.error(err?.message ?? "Falha no upload.");
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Loop de parts — chamado tanto no start quanto no resume. Lê estado
   * do store, identifica parts faltantes, sobe uma por uma, persiste, e
   * chama complete ao final.
   */
  const runUploadLoop = useCallback(
    async (uploadId: string, file: File) => {
      // Snapshot atual do store
      const snap = useVideoUploadManager.getState().uploads.get(uploadId);
      if (!snap) throw new Error("Upload não encontrado no store");

      const { totalParts, partSize, completedParts } = snap;
      const completedSet = new Set(completedParts.map((p) => p.partNumber));

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (completedSet.has(partNumber)) continue;

        // Re-lê o status a cada iteração: o user pode ter cancelado no dock.
        const current = useVideoUploadManager.getState().uploads.get(uploadId);
        if (!current || current.status !== "uploading") {
          return; // abortado ou pausado externamente
        }

        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);

        // Pega URL fresca pra cada part (presigned vale 1h, mas pra segurança).
        const { url } = await orpc.nasaRoute.creatorGetUploadPartUrl.call({
          uploadId,
          partNumber,
        });

        const etag = await putPart(url, chunk);

        useVideoUploadManager.getState().addPart(uploadId, partNumber, etag);

        // Persiste após cada chunk — caro mas seguro. Vídeo de 2GB = 200 escritas.
        const updated = useVideoUploadManager.getState().uploads.get(uploadId);
        if (updated) {
          // Tira `file` (não-serializável) antes de persistir.
          const { file: _f, progressPct: _p, ...rest } = updated;
          void _f;
          void _p;
          await saveUpload(rest);
        }
      }

      // Todas parts OK → complete
      const final = useVideoUploadManager.getState().uploads.get(uploadId);
      if (!final) return;

      await orpc.nasaRoute.creatorCompleteVideoUpload.call({
        uploadId,
        parts: final.completedParts,
      });

      // Invalida query do curso pra refletir o novo videoFileKey na UI.
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

      // Some do dock após 5s.
      setTimeout(() => {
        useVideoUploadManager.getState().remove(uploadId);
      }, 5000);
    },
    [qc],
  );

  /** Retoma upload que tem persisted state mas perdeu o File (reload). */
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
      await runUploadLoop(uploadId, file);
    },
    [runUploadLoop],
  );

  /** Cancela: chama abort no server + limpa local. */
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
