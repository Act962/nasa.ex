import "server-only";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { S3, deleteStoredObject } from "@/lib/s3-client";

// Objetos do Nbox no R2 (spec 0148). Todo arquivo novo mora em `nbox/<organizationId>/` (guardado) ou
// `nbox-transfers/<organizationId>/` (temporário): o prefixo prova de quem ele é e permite apagar o objeto junto com o
// item sem risco de apagar arquivo usado por outra tela. A regra de expiração do bucket só olha `nbox-transfers/` (D-8).

const UPLOAD_URL_TTL_SECONDS = 60 * 60;

const bucketName = () => process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!;

export type NboxObjectKind = "stored" | "transfer";

const STORED_ROOT = "nbox/";
export const TRANSFER_ROOT = "nbox-transfers/";

const nboxKeyPrefix = (organizationId: string, kind: NboxObjectKind) =>
  `${kind === "transfer" ? TRANSFER_ROOT : STORED_ROOT}${organizationId}/`;

/** Sem `kind`, aceita os dois prefixos da empresa. */
export function isNboxObjectKeyOf(organizationId: string, key: string, kind?: NboxObjectKind): boolean {
  if (key.includes("..")) return false;
  if (kind) return key.startsWith(nboxKeyPrefix(organizationId, kind));
  return key.startsWith(nboxKeyPrefix(organizationId, "stored")) || key.startsWith(nboxKeyPrefix(organizationId, "transfer"));
}

export function buildNboxObjectKey(organizationId: string, fileName: string, kind: NboxObjectKind): string {
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) : "";
  return `${nboxKeyPrefix(organizationId, kind)}${uuidv4()}${extension ? `.${extension}` : ""}`;
}

export function createSingleUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(S3, new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
}

export async function createMultipartUpload(key: string, contentType: string, totalParts: number) {
  const created = await S3.send(new CreateMultipartUploadCommand({ Bucket: bucketName(), Key: key, ContentType: contentType }));
  if (!created.UploadId) throw new Error("O armazenamento não abriu o envio em partes.");
  const multipartUploadId = created.UploadId;
  const partUploadUrls = await Promise.all(
    Array.from({ length: totalParts }, (_, index) =>
      getSignedUrl(
        S3,
        new UploadPartCommand({ Bucket: bucketName(), Key: key, UploadId: multipartUploadId, PartNumber: index + 1 }),
        { expiresIn: UPLOAD_URL_TTL_SECONDS },
      ),
    ),
  );
  return { multipartUploadId, partUploadUrls };
}

export async function completeMultipartUpload(
  key: string,
  multipartUploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<void> {
  const sortedParts = [...parts].sort((left, right) => left.partNumber - right.partNumber);
  await S3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName(),
      Key: key,
      UploadId: multipartUploadId,
      MultipartUpload: { Parts: sortedParts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    }),
  );
}

/** Tamanho real gravado no R2; null quando o objeto não existe. */
export async function readStoredObjectSize(key: string): Promise<number | null> {
  try {
    const head = await S3.send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

export async function copyStoredObject(sourceKey: string, targetKey: string): Promise<void> {
  await S3.send(
    new CopyObjectCommand({
      Bucket: bucketName(),
      Key: targetKey,
      CopySource: `${bucketName()}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
    }),
  );
}

/** Link assinado de leitura com o nome original do arquivo; `inline` abre no navegador quando dá. */
export function createDownloadUrl(
  key: string,
  fileName: string,
  expiresInSeconds: number,
  disposition: "attachment" | "inline" = "attachment",
): Promise<string> {
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return getSignedUrl(
    S3,
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key,
      ResponseContentDisposition: `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: expiresInSeconds },
  );
}

/** Só apaga objeto do prefixo da empresa: chaves antigas podem estar em uso por outras telas (spec 0148, CA-8). */
export async function deleteNboxObjectIfOwned(organizationId: string, key: string | null | undefined): Promise<void> {
  if (!key || !isNboxObjectKeyOf(organizationId, key)) return;
  await deleteStoredObject(key);
}

/** Aborta envios em partes do Nbox abandonados há mais de 1 dia (spec 0148, CB-2). Sem tabela: o R2 lista os pendentes. */
export async function abortStaleNboxMultipartUploads(): Promise<number> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const listings = await Promise.all(
    [STORED_ROOT, TRANSFER_ROOT].map((prefix) =>
      S3.send(new ListMultipartUploadsCommand({ Bucket: bucketName(), Prefix: prefix, MaxUploads: 500 })),
    ),
  );
  const staleUploads = listings.flatMap((listing) => listing.Uploads ?? []).filter(
    (upload) => upload.Key && upload.UploadId && upload.Initiated && upload.Initiated.getTime() < cutoff,
  );
  for (const upload of staleUploads) {
    await S3.send(new AbortMultipartUploadCommand({ Bucket: bucketName(), Key: upload.Key!, UploadId: upload.UploadId! })).catch(() => null);
  }
  return staleUploads.length;
}
