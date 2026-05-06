import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";

/**
 * Aluno baixa o eBook depois de comprado.
 *
 * Pré-requisitos:
 * 1. Usuário autenticado.
 * 2. Matrícula ativa no curso.
 * 3. Curso é do formato `ebook` e tem `ebookFileKey` definido.
 *
 * Retorna uma presigned GET URL com TTL de 5 minutos. O link é "queimado"
 * automaticamente — se vazar, expira sozinho. Não dá pra link pré-buscar
 * ou cachear no client.
 */
export const getEbookDownloadUrl = base
  .use(requiredAuthMiddleware)
  .input(z.object({ courseId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;

    // 1. Verifica matrícula ativa
    const enrollment = await prisma.nasaRouteEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: input.courseId } },
      select: { id: true, status: true },
    });
    if (!enrollment || enrollment.status !== "active") {
      throw new ORPCError("FORBIDDEN", {
        message: "Você precisa comprar este eBook antes de baixar",
      });
    }

    // 2. Busca dados do eBook
    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        format: true,
        title: true,
        ebookFileKey: true,
        ebookFileName: true,
        ebookMimeType: true,
        ebookFileSize: true,
      },
    });
    if (!course) {
      throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado" });
    }
    if (course.format !== "ebook") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Este produto não é um eBook",
      });
    }
    if (!course.ebookFileKey) {
      throw new ORPCError("NOT_FOUND", {
        message: "Arquivo do eBook não encontrado. Avise o criador do curso.",
      });
    }

    // 3. Gera presigned GET URL
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
    if (!bucket) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Storage não configurado",
      });
    }

    // Sugere o nome amigável no download (Content-Disposition)
    const friendlyName =
      course.ebookFileName ?? `${course.title.replace(/[^\w\s-]/g, "_")}.pdf`;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: course.ebookFileKey,
      ResponseContentDisposition: `attachment; filename="${friendlyName}"`,
      ResponseContentType: course.ebookMimeType ?? undefined,
    });

    const downloadUrl = await getSignedUrl(S3, command, {
      expiresIn: 60 * 5, // 5 minutos
    });

    return {
      downloadUrl,
      fileName: friendlyName,
      mimeType: course.ebookMimeType,
      fileSize: course.ebookFileSize,
      expiresInSeconds: 60 * 5,
    };
  });
