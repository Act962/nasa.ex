import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";
import { requireCourseManager } from "../utils";
import {
  computeVideoUploadCost,
  VIDEO_UPLOAD_ALLOWED_MIMES,
  VIDEO_UPLOAD_MAX_BYTES,
  VIDEO_UPLOAD_PART_SIZE_BYTES,
} from "@/features/nasa-route/lib/video-storage-pricing";
import { getStarPriceBrl } from "@/features/nasa-route/lib/pricing";
import { debitStars } from "@/features/stars/lib/star-service";
import { StarTransactionType } from "@/generated/prisma/enums";

const VIDEO_BUCKET_ENV = "R2_NASA_ROUTE_BUCKET";

/**
 * Inicia um upload multipart de vídeo no bucket R2 NASA Route:
 * 1. Recalcula o custo em STARs (não confia no client) e debita upfront.
 *    `allowBonus: false` — bônus de STARs (welcome, promo) não cobre
 *    hospedagem; só saldo gastável.
 * 2. Abre um CreateMultipartUpload no R2 (não transfere bytes ainda).
 * 3. Persiste registro NasaRouteVideoUpload pra autorizar parts subsequentes
 *    e permitir resume após reload da página.
 *
 * Se a etapa de R2 falhar APÓS o débito de STARs, a transação Prisma faz
 * rollback do débito (a sessão R2 vazia não custa nada).
 */
export const creatorStartVideoUpload = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      lessonId: z.string().min(1),
      sizeBytes: z
        .number()
        .int()
        .min(1)
        .max(VIDEO_UPLOAD_MAX_BYTES, "Vídeo excede o limite de 2 GB"),
      mimeType: z.enum(VIDEO_UPLOAD_ALLOWED_MIMES),
      filename: z.string().min(1).max(255),
    }),
  )
  .handler(async ({ input, context }) => {
    const bucket = process.env[VIDEO_BUCKET_ENV];
    if (!bucket) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `${VIDEO_BUCKET_ENV} não configurado no servidor`,
      });
    }

    await requireCourseManager(context.user.id, input.courseId);

    // Confirma que a aula pertence ao curso (evita upload "fora" do curso).
    const lesson = await prisma.nasaRouteLesson.findUnique({
      where: { id: input.lessonId },
      select: { id: true, courseId: true },
    });
    if (!lesson || lesson.courseId !== input.courseId) {
      throw new ORPCError("NOT_FOUND", { message: "Aula não encontrada" });
    }

    const starPriceBrl = await getStarPriceBrl();
    const breakdown = computeVideoUploadCost(input.sizeBytes, starPriceBrl);
    const costStars = breakdown.stars;
    const totalParts = breakdown.totalParts;

    // ── 1. Débito de STARs (atômico). Lança se saldo insuficiente.
    const debit = await debitStars(
      context.org.id,
      costStars,
      StarTransactionType.APP_CHARGE,
      `Upload vídeo NASA Route — ${breakdown.sizeGb.toFixed(2)} GB`,
      "nasa-route-storage",
      context.user.id,
      { allowBonus: false }, // bônus não cobre hospedagem
    );
    if (!debit.success) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Saldo de STARs insuficiente. Necessário: ${costStars} ★`,
        data: {
          code: "INSUFFICIENT_STARS",
          balance: debit.newBalance,
          bonusBalance: debit.newBonusBalance,
          needed: costStars,
        },
      });
    }

    // ── 2. Abre multipart no R2. Se falhar, refundamos via creditStars manual.
    const safeFilename = input.filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    const fileKey = `nasa-route/lesson-videos/${input.courseId}/${input.lessonId}/${uuidv4()}-${safeFilename}`;

    let multipartUploadId: string;
    try {
      const result = await S3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: fileKey,
          ContentType: input.mimeType,
        }),
      );
      if (!result.UploadId) {
        throw new Error("R2 retornou sem UploadId");
      }
      multipartUploadId = result.UploadId;
    } catch (err) {
      // Refund manual via StarTransaction REFUND (não usa creditStars helper
      // pra manter o COURSE_PURCHASE/REFUND audit trail consistente).
      await prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: context.org.id },
          data: { starsBalance: { increment: costStars } },
        });
        const org = await tx.organization.findUniqueOrThrow({
          where: { id: context.org.id },
          select: { starsBalance: true },
        });
        await tx.starTransaction.create({
          data: {
            organizationId: context.org.id,
            type: StarTransactionType.REFUND,
            amount: costStars,
            balanceAfter: org.starsBalance,
            description: `Estorno: falha ao iniciar upload vídeo (${input.filename})`,
            appSlug: "nasa-route-storage",
          },
        });
      });
      console.error("[creatorStartVideoUpload] R2 CreateMultipartUpload failed:", err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Falha ao iniciar upload no storage. STARs estornadas.",
      });
    }

    // ── 3. Persiste tracking do upload.
    const created = await prisma.nasaRouteVideoUpload.create({
      data: {
        courseId: input.courseId,
        lessonId: input.lessonId,
        userId: context.user.id,
        organizationId: context.org.id,
        fileKey,
        multipartUploadId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        totalParts,
        costStars,
        status: "uploading",
      },
      select: { id: true },
    });

    return {
      uploadId: created.id,
      multipartUploadId,
      fileKey,
      totalParts,
      partSize: VIDEO_UPLOAD_PART_SIZE_BYTES,
      costStars,
    };
  });
