import "server-only";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "./s3-client";

/**
 * Returns a 1-hour presigned URL for a given R2 key.
 * Used when we need a publicly accessible URL to pass to external APIs (e.g. Meta Graph API).
 */
export async function getPresignedReadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
    Key: key,
  });
  return getSignedUrl(S3, command, { expiresIn: expiresInSeconds });
}

/**
 * Returns the public CDN URL if the bucket has a public domain configured,
 * otherwise falls back to a presigned URL.
 */
export async function getPublicMediaUrl(key: string): Promise<string> {
  if (key.startsWith("http://") || key.startsWith("https://")) return key;

  const publicBase = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (publicBase && publicBase !== "undefined") {
    // A env pode vir com ou sem protocolo e com barra final. Sem normalizar,
    // um valor `https://cdn.exemplo.com` virava `https://https://cdn...`.
    const host = publicBase.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${host}/${key.replace(/^\/+/, "")}`;
  }
  return getPresignedReadUrl(key);
}
