import { get, set, del, keys, createStore } from "idb-keyval";

/**
 * Persistência local de uploads de vídeo em andamento, pra sobreviver a
 * reload de página. Cada entrada guarda o estado mínimo pra retomar:
 * - `uploadId` (server) — referência pra autorizar parts subsequentes
 * - `multipartUploadId` (R2) — referência pra completar/abortar
 * - `fileKey` — chave final no R2
 * - `completedParts` — lista de parts já enviadas com seus ETags
 * - `file` ref via `FileSystemHandle` NÃO — File API browsers ainda não
 *   permitem reabrir File após reload sem File System Access API (Chrome).
 *   Por isso ao reload pedimos o user re-selecionar o arquivo, mas as parts
 *   já enviadas pulam o reupload (R2 mantém parts até abort/expire).
 *
 * Note: idb-keyval cria a store na primeira escrita; não precisa migrate.
 */

const STORE_NAME = "nasa-route-video-uploads";
const DB_NAME = "nasa-route-uploads-db";

const uploadsStore =
  typeof indexedDB !== "undefined"
    ? createStore(DB_NAME, STORE_NAME)
    : undefined;

export interface PersistedUploadPart {
  partNumber: number;
  etag: string;
}

export interface PersistedUpload {
  // IDs
  uploadId: string;
  multipartUploadId: string;
  fileKey: string;
  // Contexto
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  // Arquivo
  filename: string;
  mimeType: string;
  sizeBytes: number;
  totalParts: number;
  partSize: number;
  costStars: number;
  // Progresso
  completedParts: PersistedUploadPart[];
  status: "uploading" | "paused" | "completed" | "aborted" | "failed";
  startedAt: number; // epoch ms
  lastUpdatedAt: number;
  errorMessage?: string;
}

function ensureStore() {
  if (!uploadsStore) {
    throw new Error("IndexedDB indisponível neste contexto (SSR ou browser muito antigo)");
  }
  return uploadsStore;
}

export async function saveUpload(upload: PersistedUpload): Promise<void> {
  await set(upload.uploadId, { ...upload, lastUpdatedAt: Date.now() }, ensureStore());
}

export async function loadUpload(
  uploadId: string,
): Promise<PersistedUpload | undefined> {
  return get<PersistedUpload>(uploadId, ensureStore());
}

export async function deleteUpload(uploadId: string): Promise<void> {
  await del(uploadId, ensureStore());
}

export async function listAllUploads(): Promise<PersistedUpload[]> {
  if (!uploadsStore) return [];
  const allKeys = await keys(uploadsStore);
  const results = await Promise.all(
    allKeys.map((k) => get<PersistedUpload>(k as string, uploadsStore!)),
  );
  return results.filter((u): u is PersistedUpload => !!u);
}
