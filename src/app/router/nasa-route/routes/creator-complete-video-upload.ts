import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import { r2NasaRouteVideoUrl } from "@/features/nasa-route/lib/video-storage-url";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

const VIDEO_BUCKET_ENV = "R2_NASA_ROUTE_BUCKET";

/**
 * Finaliza o multipart upload: chama CompleteMultipartUpload no R2 (commit do
 * arquivo) e grava `videoFileKey`/`videoFileSize` na aula. Limpa `videoUrl`
 * (links YouTube/Vimeo) pra manter a regra "ou um ou outro".
 *
 * Idempotência: se já estiver "completed", retorna sucesso direto. Isso
 * tolera race condition entre o cliente que pode reenviar o complete em
 * casos de timeout de rede no caminho cliente→servidor.
 */
export const creatorCompleteVideoUpload = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      uploadId: z.string().min(1),
      parts: z
        .array(
          z.object({
            partNumber: z.number().int().min(1).max(10000),
            etag: z.string().min(1),
          }),
        )
        .min(1)
        .max(10000),
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
        id: true,
        userId: true,
        status: true,
        fileKey: true,
        multipartUploadId: true,
        totalParts: true,
        sizeBytes: true,
        lessonId: true,
      },
    });
    if (!upload) {
      throw new ORPCError("NOT_FOUND", { message: "Upload não encontrado" });
    }
    if (upload.userId !== context.user.id) {
      throw new ORPCError("FORBIDDEN", { message: "Upload pertence a outro usuário" });
    }
    if (upload.status === "completed") {
      return {
        success: true,
        fileKey: upload.fileKey,
        videoUrl: r2NasaRouteVideoUrl(upload.fileKey),
      };
    }
    if (upload.status !== "uploading") {
      throw new ORPCError("BAD_REQUEST", {
        message: `Upload com status "${upload.status}" não pode ser finalizado`,
      });
    }
    if (input.parts.length !== upload.totalParts) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Esperado ${upload.totalParts} parts, recebido ${input.parts.length}`,
      });
    }

    // R2 exige parts ordenadas por PartNumber crescente.
    const sortedParts = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);

    try {
      await S3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: upload.fileKey,
          UploadId: upload.multipartUploadId,
          MultipartUpload: {
            Parts: sortedParts.map((p) => ({
              PartNumber: p.partNumber,
              ETag: p.etag,
            })),
          },
        }),
      );
    } catch (err) {
      console.error("[creatorCompleteVideoUpload] R2 Complete failed:", err);
      // Não estornamos STARs aqui — o cliente pode retentar (parts ainda no R2).
      // Se desistir, deve chamar abort explicitamente.
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Falha ao finalizar upload no storage. Tente novamente.",
      });
    }

    // Atualiza a aula e o registro de upload na mesma transação.
    await prisma.$transaction([
      prisma.nasaRouteLesson.update({
        where: { id: upload.lessonId },
        data: {
          videoFileKey: upload.fileKey,
          videoFileSize: upload.sizeBytes,
          // Regra "um ou outro": ao concluir upload, zera link externo.
          videoUrl: null,
          videoProvider: null,
          videoId: null,
        },
      }),
      prisma.nasaRouteVideoUpload.update({
        where: { id: upload.id },
        data: { status: "completed", completedAt: new Date() },
      }),
    ]);

    // Cobra Stars do criador pelo processamento do vídeo finalizado.
    // O upload em si (start) pode ter cobrança própria — aqui é o
    // "fechamento" da operação. Regra global "nasa_route_video_upload_complete".
    // Best-effort: se a cobrança falhar, o upload ainda foi salvo
    // (não estornamos R2). Operação continua com sucesso.
    const orgMember = await prisma.member.findFirst({
      where: { userId: upload.userId },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    });
    if (orgMember) {
      try {
        await chargeStarsByAction(
          orgMember.organizationId,
          "nasa_route_video_upload_complete",
          {
            userId: upload.userId,
            description: "NASA Route — vídeo de aula finalizado",
            appSlug: "nasa-route",
          },
        );
      } catch (e) {
        console.error("[creatorCompleteVideoUpload] charge failed:", e);
      }
    }

    return {
      success: true,
      fileKey: upload.fileKey,
      videoUrl: r2NasaRouteVideoUrl(upload.fileKey),
    };
  });
