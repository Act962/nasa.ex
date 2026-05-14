import { create } from "zustand";
import type { PersistedUpload } from "../lib/upload-manager-db";

/**
 * Store global de uploads de vídeo. Mantém em memória o estado de cada
 * upload ativo (com File handle pra continuar) + reflete progresso pra UI.
 *
 * Por que duas fontes (memória + IndexedDB):
 * - Memória (Zustand): File object original (não persistido) + estado live
 *   de progresso enquanto a aba está aberta.
 * - IndexedDB (upload-manager-db.ts): completedParts persistidos pra
 *   sobreviver a reload. Após reload, store é rehidratado SEM o File — UI
 *   oferece "selecionar arquivo de novo pra retomar".
 *
 * O hook `useVideoUpload` (hooks/use-video-upload.ts) é quem orquestra:
 * popula store, dispara parts, atualiza progresso, e chama persistência.
 */

export interface ActiveUpload extends PersistedUpload {
  /** File em memória — `null` se rehidratado de IndexedDB pós-reload. */
  file: File | null;
  /** 0..100, calculado de `completedParts.length / totalParts`. */
  progressPct: number;
}

interface VideoUploadManagerStore {
  uploads: Map<string, ActiveUpload>;

  // Mutations (chamadas pelo hook use-video-upload)
  upsert: (upload: ActiveUpload) => void;
  patch: (uploadId: string, patch: Partial<ActiveUpload>) => void;
  addPart: (uploadId: string, partNumber: number, etag: string) => void;
  remove: (uploadId: string) => void;
}

function computeProgress(u: { completedParts: { partNumber: number }[]; totalParts: number }) {
  if (u.totalParts === 0) return 0;
  return Math.min(100, Math.round((u.completedParts.length / u.totalParts) * 100));
}

export const useVideoUploadManager = create<VideoUploadManagerStore>(
  (set) => ({
    uploads: new Map(),

    upsert: (upload) =>
      set((state) => {
        const next = new Map(state.uploads);
        next.set(upload.uploadId, {
          ...upload,
          progressPct: computeProgress(upload),
        });
        return { uploads: next };
      }),

    patch: (uploadId, patch) =>
      set((state) => {
        const existing = state.uploads.get(uploadId);
        if (!existing) return state;
        const next = new Map(state.uploads);
        const updated = { ...existing, ...patch, lastUpdatedAt: Date.now() };
        updated.progressPct = computeProgress(updated);
        next.set(uploadId, updated);
        return { uploads: next };
      }),

    addPart: (uploadId, partNumber, etag) =>
      set((state) => {
        const existing = state.uploads.get(uploadId);
        if (!existing) return state;
        // Evita duplicata se um part for retentado e responder OK 2x.
        const exists = existing.completedParts.some((p) => p.partNumber === partNumber);
        if (exists) return state;
        const next = new Map(state.uploads);
        const updated: ActiveUpload = {
          ...existing,
          completedParts: [...existing.completedParts, { partNumber, etag }],
          lastUpdatedAt: Date.now(),
        };
        updated.progressPct = computeProgress(updated);
        next.set(uploadId, updated);
        return { uploads: next };
      }),

    remove: (uploadId) =>
      set((state) => {
        if (!state.uploads.has(uploadId)) return state;
        const next = new Map(state.uploads);
        next.delete(uploadId);
        return { uploads: next };
      }),
  }),
);
