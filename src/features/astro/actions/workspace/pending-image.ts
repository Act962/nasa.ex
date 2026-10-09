import "server-only";
import { CopyObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { S3, deleteStoredObject } from "@/lib/s3-client";

// Imagem que o membro mandou pelo WhatsApp e ainda não entrou em nenhuma demanda (spec 0080).
// Fica no armazenamento, numa chave fixa por conversa: a primeira versão guardava em memória e a
// imagem se perdia quando o servidor reiniciava entre a foto e a resposta "criar demanda".

const PENDING_IMAGE_TTL_MS = 15 * 60_000;
const IMAGE_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export interface PendingTaskImage {
  /** Chave do arquivo no armazenamento — é o que `Action.coverImage` e `attachments[].url` guardam. */
  fileKey: string;
  fileName: string;
  mimeType: string;
}

function bucketName(): string | null {
  return process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES || null;
}

function pendingKeyFor(sessionId: string): string {
  return `workspace/pending/${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** Guarda (ou substitui) a imagem pendente da conversa. Lança se o armazenamento recusar. */
export async function setPendingTaskImage(
  sessionId: string,
  image: { body: Buffer; fileName: string; mimeType: string },
): Promise<void> {
  const bucket = bucketName();
  if (!bucket) throw new Error("bucket de imagens não configurado");
  await S3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: pendingKeyFor(sessionId),
      Body: image.body,
      ContentType: image.mimeType,
      // Metadado de objeto só aceita ASCII: o nome original pode ter acento.
      Metadata: { filename: encodeURIComponent(image.fileName) },
    }),
  );
}

/** Há imagem esperando destino? Imagem mais velha que a validade é apagada e não conta. */
export async function peekPendingTaskImage(sessionId: string | undefined): Promise<Omit<PendingTaskImage, "fileKey"> | null> {
  const bucket = bucketName();
  if (!sessionId || !bucket) return null;
  const pendingKey = pendingKeyFor(sessionId);
  const head = await S3.send(new HeadObjectCommand({ Bucket: bucket, Key: pendingKey })).catch(() => null);
  if (!head) return null;
  const isExpired = head.LastModified ? Date.now() - head.LastModified.getTime() > PENDING_IMAGE_TTL_MS : false;
  if (isExpired) {
    await deleteStoredObject(pendingKey);
    return null;
  }
  const mimeType = head.ContentType ?? "image/jpeg";
  const storedName = head.Metadata?.filename ? decodeURIComponent(head.Metadata.filename) : "";
  return { fileName: storedName || `whatsapp-foto.${IMAGE_EXTENSIONS[mimeType] ?? "jpg"}`, mimeType };
}

/** Move a imagem pendente para o lugar definitivo dos anexos e devolve a chave. A imagem entra em uma demanda só. */
export async function takePendingTaskImage(
  sessionId: string | undefined,
  organizationId: string,
): Promise<PendingTaskImage | null> {
  const bucket = bucketName();
  const pending = await peekPendingTaskImage(sessionId);
  if (!pending || !sessionId || !bucket) return null;
  const pendingKey = pendingKeyFor(sessionId);
  const fileKey = `workspace/attachments/${organizationId}/${uuidv4()}.${IMAGE_EXTENSIONS[pending.mimeType] ?? "jpg"}`;
  await S3.send(new CopyObjectCommand({ Bucket: bucket, Key: fileKey, CopySource: `${bucket}/${pendingKey}` }));
  await deleteStoredObject(pendingKey);
  return { fileKey, fileName: pending.fileName, mimeType: pending.mimeType };
}

/** Apaga a imagem que ninguém destinou. `true` quando havia uma. */
export async function discardPendingTaskImage(sessionId: string | undefined): Promise<boolean> {
  const pending = await peekPendingTaskImage(sessionId);
  if (!pending || !sessionId) return false;
  await deleteStoredObject(pendingKeyFor(sessionId));
  return true;
}

/** Como a imagem entra na demanda: sempre anexo; capa quando não havia uma, ou quando pedido. */
export function applyImageToTask(params: {
  image: PendingTaskImage;
  currentAttachments: unknown;
  currentCoverImage: string | null;
  shouldReplaceCover?: boolean;
}): { attachments: { name: string; url: string; type?: string }[]; coverImage: string | null; isCoverSet: boolean } {
  const existingAttachments = Array.isArray(params.currentAttachments)
    ? (params.currentAttachments as { name: string; url: string; type?: string }[])
    : [];
  const isCoverSet = !params.currentCoverImage || Boolean(params.shouldReplaceCover);
  return {
    attachments: [
      ...existingAttachments,
      { name: params.image.fileName, url: params.image.fileKey, type: params.image.mimeType },
    ],
    coverImage: isCoverSet ? params.image.fileKey : params.currentCoverImage,
    isCoverSet,
  };
}
