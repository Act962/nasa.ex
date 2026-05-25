import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { inngest } from "@/inngest/client";

/**
 * Reporta uma part concluída ao servidor.
 * Não escreve no banco — apenas valida ownership e dispara evento Inngest
 * para que o canal Realtime publique o progresso ao frontend via SSE.
 * ETags e progresso continuam gerenciados client-side (Zustand + IndexedDB).
 */
export const creatorReportUploadPart = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      uploadId: z.string().min(1),
      partNumber: z.number().int().min(1).max(10000),
      etag: z.string().min(1),
      progressPct: z.number().int().min(0).max(100),
      completedParts: z.number().int().min(1),
      totalParts: z.number().int().min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const upload = await prisma.nasaRouteVideoUpload.findUnique({
      where: { id: input.uploadId },
      select: { userId: true, status: true },
    });

    if (!upload) {
      throw new ORPCError("NOT_FOUND", { message: "Upload não encontrado" });
    }
    if (upload.userId !== context.user.id) {
      throw new ORPCError("FORBIDDEN", { message: "Upload pertence a outro usuário" });
    }
    // Se já foi abortado/concluído, ignora silenciosamente — workers paralelos
    // podem reportar parts após o abort por race condition.
    if (upload.status !== "uploading") {
      return { ok: false };
    }

    await inngest.send({
      name: "nasa-route/video.upload.part-done",
      data: {
        uploadId: input.uploadId,
        progressPct: input.progressPct,
        completedParts: input.completedParts,
        totalParts: input.totalParts,
      },
    });

    return { ok: true };
  });
