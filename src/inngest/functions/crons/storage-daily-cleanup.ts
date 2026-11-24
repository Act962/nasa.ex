/**
 * Cron: storage-daily-cleanup (antigo nasa-route-video-uploads-cleanup)
 *
 * Roda 1x por dia às 04h UTC e limpa o que custa armazenamento sem uso (spec 0148, D-4):
 * 1. Uploads de vídeo do ÓRBITA Route abandonados há 7 dias: `AbortMultipartUpload` e registro "expired".
 *    STARs NÃO são reembolsadas no v1 — mesmo comportamento do abort manual.
 * 2. Transferências do Nbox vencidas: apaga arquivos e registros (o link já parou no vencimento).
 * 3. Envios em partes do Nbox abandonados há 1 dia.
 *
 * Um cron só, para não somar execução no plano do Inngest (CLAUDE.md, S11). Cada passo é independente:
 * falta de bucket de um não impede o outro.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import { purgeExpiredNboxTransfers } from "@/features/nbox/server/transfers";
import { abortStaleNboxMultipartUploads } from "@/features/nbox/server/storage-objects";

const ROUTE_VIDEO_EXPIRATION_DAYS = 7;
const VIDEO_BUCKET_ENV = "R2_NASA_ROUTE_BUCKET";

async function cleanupStaleRouteVideoUploads() {
  const bucket = process.env[VIDEO_BUCKET_ENV];
  if (!bucket) return { skipped: true, reason: `${VIDEO_BUCKET_ENV} não configurado` };

  const cutoff = new Date(Date.now() - ROUTE_VIDEO_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  const staleUploads = await prisma.nasaRouteVideoUpload.findMany({
    where: { status: "uploading", startedAt: { lt: cutoff } },
    select: { id: true, fileKey: true, multipartUploadId: true },
  });

  let errors = 0;
  for (const upload of staleUploads) {
    try {
      await S3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: upload.fileKey, UploadId: upload.multipartUploadId }));
    } catch (error) {
      // R2 retorna NoSuchUpload se já foi abortado/expirado — ignore.
      console.warn(`[cron] AbortMultipartUpload falhou pra ${upload.id} (provavelmente já abortado):`, error instanceof Error ? error.message : error);
      errors++;
    }
    await prisma.nasaRouteVideoUpload.update({ where: { id: upload.id }, data: { status: "expired", completedAt: new Date() } });
  }
  return { processed: staleUploads.length, errors };
}

export const storageDailyCleanup = inngest.createFunction(
  { id: "storage-daily-cleanup", retries: 1 },
  { cron: "0 4 * * *" },
  async ({ step }) => {
    const routeVideos = await step.run("nasa-route-stale-video-uploads", cleanupStaleRouteVideoUploads);
    const nboxTransfers = await step.run("nbox-expired-transfers", purgeExpiredNboxTransfers);
    const nboxMultipart = await step.run("nbox-stale-multipart-uploads", abortStaleNboxMultipartUploads);
    return { routeVideos, nboxTransfers, nboxMultipart };
  },
);
