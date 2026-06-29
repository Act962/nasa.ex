import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3 } from "@/lib/s3-client";

const VIDEO_BUCKET_ENV = "R2_NASA_ROUTE_BUCKET";
const PART_URL_EXPIRES_SECONDS = 60 * 60; // 1 hora

/**
 * Gera presigned PUT URL pra uma única part do multipart upload. O cliente
 * faz o PUT direto pro R2 (bypass do servidor) e captura o ETag retornado.
 *
 * Chamada N vezes durante o upload (uma por part). Cada URL vale 1h —
 * suficiente pra 1 chunk de 10 MB em qualquer conexão decente.
 */
export const creatorGetUploadPartUrl = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      uploadId: z.string().min(1),
      partNumber: z.number().int().min(1).max(10000),
    }),
  )
  .handler(async ({ input, context }) => {
    const bucket = process.env[VIDEO_BUCKET_ENV];
    if (!bucket) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Bucket de vídeo não configurado",
      });
    }

    const upload = await prisma.nasaRouteVideoUpload.findUnique({
      where: { id: input.uploadId },
      select: {
        userId: true,
        status: true,
        fileKey: true,
        multipartUploadId: true,
        totalParts: true,
      },
    });
    if (!upload) {
      throw new ORPCError("NOT_FOUND", { message: "Upload não encontrado" });
    }
    if (upload.userId !== context.user.id) {
      throw new ORPCError("FORBIDDEN", { message: "Upload pertence a outro usuário" });
    }
    if (upload.status !== "uploading") {
      throw new ORPCError("BAD_REQUEST", {
        message: `Upload já está com status "${upload.status}"`,
      });
    }
    if (input.partNumber > upload.totalParts) {
      throw new ORPCError("BAD_REQUEST", {
        message: `partNumber ${input.partNumber} excede totalParts ${upload.totalParts}`,
      });
    }

    const url = await getSignedUrl(
      S3,
      new UploadPartCommand({
        Bucket: bucket,
        Key: upload.fileKey,
        UploadId: upload.multipartUploadId,
        PartNumber: input.partNumber,
      }),
      { expiresIn: PART_URL_EXPIRES_SECONDS },
    );

    return { url, expiresIn: PART_URL_EXPIRES_SECONDS };
  });
