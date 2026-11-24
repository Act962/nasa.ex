import "server-only";

import { NBOX_MAX_FILE_BYTES, NBOX_MULTIPART_THRESHOLD_BYTES, NBOX_PART_SIZE_BYTES } from "@/features/nbox/lib/storage-limits";
import { assertNboxStorageAvailable, NboxStorageFullError } from "@/features/nbox/server/storage-usage";
import {
  type NboxObjectKind,
  buildNboxObjectKey,
  completeMultipartUpload,
  createMultipartUpload,
  createSingleUploadUrl,
  deleteNboxObjectIfOwned,
  isNboxObjectKeyOf,
  readStoredObjectSize,
} from "@/features/nbox/server/storage-objects";

// Envio do Nbox (spec 0148, RF-2 a RF-4): o servidor escolhe a chave, confere o espaço antes e depois e grava o tamanho real.

export class NboxUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NboxUploadError";
  }
}

/** Mensagem que pode ir para a pessoa; null para erro inesperado. */
export const toNboxUserMessage = (error: unknown): string | null =>
  error instanceof NboxUploadError || error instanceof NboxStorageFullError ? error.message : null;

export type NboxUploadTicket =
  | { mode: "single"; key: string; uploadUrl: string }
  | { mode: "multipart"; key: string; multipartUploadId: string; partSize: number; partUploadUrls: string[] };

export async function startNboxUpload(params: {
  organizationId: string;
  /** Vem de `assertFolderWritable`: arquivo de transferência mora no prefixo temporário (D-8). */
  kind: NboxObjectKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<NboxUploadTicket> {
  if (params.sizeBytes > NBOX_MAX_FILE_BYTES) throw new NboxUploadError("Arquivo maior que 5 GB.");
  await assertNboxStorageAvailable(params.organizationId, params.sizeBytes);

  const key = buildNboxObjectKey(params.organizationId, params.fileName, params.kind);
  if (params.sizeBytes <= NBOX_MULTIPART_THRESHOLD_BYTES) {
    return { mode: "single", key, uploadUrl: await createSingleUploadUrl(key, params.contentType) };
  }
  const totalParts = Math.ceil(params.sizeBytes / NBOX_PART_SIZE_BYTES);
  const { multipartUploadId, partUploadUrls } = await createMultipartUpload(key, params.contentType, totalParts);
  return { mode: "multipart", key, multipartUploadId, partSize: NBOX_PART_SIZE_BYTES, partUploadUrls };
}

/** Fecha o envio e devolve o tamanho real. Arquivo que não cabe mais (envio simultâneo, CB-1) é apagado. */
export async function finishNboxUpload(params: {
  organizationId: string;
  kind: NboxObjectKind;
  key: string;
  multipartUploadId?: string;
  parts?: Array<{ partNumber: number; etag: string }>;
}): Promise<{ sizeBytes: number }> {
  if (!isNboxObjectKeyOf(params.organizationId, params.key, params.kind)) {
    throw new NboxUploadError("Arquivo não pertence a esta empresa ou a esta pasta.");
  }

  if (params.multipartUploadId) {
    if (!params.parts?.length) throw new NboxUploadError("Envio em partes sem partes.");
    await completeMultipartUpload(params.key, params.multipartUploadId, params.parts);
  }

  const sizeBytes = await readStoredObjectSize(params.key);
  if (sizeBytes === null) throw new NboxUploadError("O arquivo não chegou ao armazenamento. Envie de novo.");
  if (sizeBytes > NBOX_MAX_FILE_BYTES) {
    await deleteNboxObjectIfOwned(params.organizationId, params.key);
    throw new NboxUploadError("Arquivo maior que 5 GB.");
  }
  try {
    await assertNboxStorageAvailable(params.organizationId, sizeBytes);
  } catch (error) {
    if (error instanceof NboxStorageFullError) await deleteNboxObjectIfOwned(params.organizationId, params.key);
    throw error;
  }
  return { sizeBytes };
}
