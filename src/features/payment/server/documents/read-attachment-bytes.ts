import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";

// Bytes de um anexo financeiro no R2. O bucket é o mesmo da rota de upload e
// de download (`NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES`).

export async function readAttachmentBytes(fileKey: string): Promise<Uint8Array | null> {
  const object = await S3.send(
    new GetObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
      Key: fileKey,
    }),
  );
  const bytes = await object.Body?.transformToByteArray();
  return bytes ?? null;
}
