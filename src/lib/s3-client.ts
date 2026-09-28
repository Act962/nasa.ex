import "server-only";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  requestHandler: {
    requestTimeout: 10_000,
    connectionTimeout: 5_000,
  },
  forcePathStyle: false,
});

/**
 * Apaga um objeto do bucket. Best-effort por design: o caller decide se a
 * falha importa. Nos fluxos de exclusão de registro (ex.: Script com vídeo),
 * deixar um objeto órfão é preferível a abortar a exclusão do registro.
 */
export async function deleteStoredObject(key: string): Promise<boolean> {
  if (!key) return false;
  try {
    await S3.send(
      new DeleteObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    console.warn("[s3] delete_object_failed", key, error);
    return false;
  }
}
