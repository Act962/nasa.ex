/**
 * Cron: nasa-route-video-uploads-cleanup
 *
 * Roda 1x por dia às 04h UTC. Varre `nasa_route_video_upload` com
 * `status = "uploading"` e `started_at < now() - 7 dias` — uploads abandonados
 * pelo criador (fechou aba e nunca voltou). Manda `AbortMultipartUpload` no R2
 * pra liberar parts órfãs e marca o registro como "expired".
 *
 * O R2 mantém parts pendentes indefinidamente (não tem auto-expiração
 * server-side), então sem esse cron acumularia custo de storage de parts
 * incompletas.
 *
 * STARs NÃO são reembolsadas no v1 — mesmo comportamento do abort manual.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";

const EXPIRATION_DAYS = 7;
const VIDEO_BUCKET_ENV = "R2_NASA_ROUTE_BUCKET";

export const nasaRouteVideoUploadsCleanup = inngest.createFunction(
  { id: "nasa-route-video-uploads-cleanup", retries: 1 },
  { cron: "0 4 * * *" },
  async ({ step }) => {
    const bucket = process.env[VIDEO_BUCKET_ENV];
    if (!bucket) {
      console.warn(`[cron] ${VIDEO_BUCKET_ENV} não configurado — skip cleanup`);
      return { skipped: true, reason: "bucket env missing" };
    }

    const cutoff = new Date(Date.now() - EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    const stale = await step.run("find-stale-uploads", () =>
      prisma.nasaRouteVideoUpload.findMany({
        where: { status: "uploading", startedAt: { lt: cutoff } },
        select: {
          id: true,
          fileKey: true,
          multipartUploadId: true,
        },
      }),
    );

    if (stale.length === 0) {
      return { processed: 0 };
    }

    let aborted = 0;
    let errors = 0;
    for (const u of stale) {
      try {
        await S3.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: u.fileKey,
            UploadId: u.multipartUploadId,
          }),
        );
      } catch (err) {
        // R2 retorna NoSuchUpload se já foi abortado/expirado — ignore.
        console.warn(
          `[cron] AbortMultipartUpload falhou pra ${u.id} (provavelmente já abortado):`,
          err instanceof Error ? err.message : err,
        );
        errors++;
      }

      await prisma.nasaRouteVideoUpload.update({
        where: { id: u.id },
        data: { status: "expired", completedAt: new Date() },
      });
      aborted++;
    }

    return { processed: stale.length, aborted, errors };
  },
);
