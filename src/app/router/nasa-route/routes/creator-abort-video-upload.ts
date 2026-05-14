import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";

const VIDEO_BUCKET_ENV = "R2_NASA_ROUTE_BUCKET";

/**
 * Cancela um upload em andamento — manda AbortMultipartUpload pro R2
 * (libera parts órfãs imediatamente) e marca o registro como "aborted".
 *
 * STARs cobradas upfront NÃO são estornadas no v1 (UX explícita no modal
 * de confirmação avisa o user). V2 pode refundar proporcional baseado em
 * parts não enviadas.
 */
export const creatorAbortVideoUpload = base
  .use(requiredAuthMiddleware)
  .input(z.object({ uploadId: z.string().min(1) }))
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
        id: true,
        userId: true,
        status: true,
        fileKey: true,
        multipartUploadId: true,
      },
    });
    if (!upload) {
      throw new ORPCError("NOT_FOUND", { message: "Upload não encontrado" });
    }
    if (upload.userId !== context.user.id) {
      throw new ORPCError("FORBIDDEN", { message: "Upload pertence a outro usuário" });
    }
    if (upload.status !== "uploading") {
      // Idempotente: já não está em andamento, nada a fazer.
      return { success: true };
    }

    try {
      await S3.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: upload.fileKey,
          UploadId: upload.multipartUploadId,
        }),
      );
    } catch (err) {
      // Mesmo se o abort no R2 falhar (upload já expirou, etc.), persistimos
      // o status local — o cron de cleanup garante o resto.
      console.warn("[creatorAbortVideoUpload] R2 Abort error (ignorado):", err);
    }

    await prisma.nasaRouteVideoUpload.update({
      where: { id: upload.id },
      data: { status: "aborted", completedAt: new Date() },
    });

    return { success: true };
  });
