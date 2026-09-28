import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resolveCampaignMetaCredentials } from "@/features/campanhas/server/lib/broadcast-access";
import {
  sendBroadcastMessage,
  type BroadcastSendConfig,
} from "@/features/campanhas/server/lib/broadcast-sender";
import { recomputeBroadcastCounters } from "@/features/campanhas/server/lib/broadcast-counters";
import { broadcastTemplateMappingSchema } from "@/features/campanhas/schema/broadcast-schemas";

/**
 * Handler de disparo em massa (Fase 3). Consome `campanhas/broadcast.send`,
 * processa os destinatários `PENDING` em lotes duráveis (`step.run`), grava o
 * `wamid`/erro em cada um e recomputa os contadores do broadcast a cada lote.
 * Contadores são recalculados por contagem (não incremento) → idempotente em
 * retries. Concorrência limitada por organização pra respeitar os limites Meta.
 */

const BATCH_SIZE = 50;
const MAX_BATCHES = 20000;
const SENT_STATUSES = ["SENT", "DELIVERED", "READ"] as const;

export const dispatchBroadcast = inngest.createFunction(
  {
    id: "campanhas-dispatch-broadcast",
    concurrency: [{ limit: 3, key: "event.data.organizationId" }],
    retries: 2,
    // Esgotou os retries: não deixa a campanha presa em SENDING pra sempre.
    // Marca os destinatários ainda pendentes como FAILED com o motivo (visível
    // na UI) e finaliza o broadcast como FAILED.
    onFailure: async ({ event, error }) => {
      const original = (event.data?.event?.data ?? {}) as {
        broadcastId?: string;
      };
      const broadcastId = original.broadcastId;
      if (!broadcastId) return;

      const reason =
        error instanceof Error
          ? error.message.slice(0, 500)
          : String(error).slice(0, 500);

      await prisma.broadcastRecipient.updateMany({
        where: { broadcastId, status: { in: ["PENDING", "QUEUED"] } },
        data: {
          status: "FAILED",
          errorCode: "DISPATCH_FAILED",
          errorMessage: reason,
        },
      });
      await prisma.broadcast.updateMany({
        where: { id: broadcastId, status: "SENDING" },
        data: { status: "FAILED", completedAt: new Date() },
      });
      await recomputeBroadcastCounters(broadcastId);
    },
  },
  { event: "campanhas/broadcast.send" },
  async ({ event, step }) => {
    const { broadcastId, organizationId } = event.data as {
      broadcastId: string;
      organizationId: string;
    };

    const setup = await step.run("load-broadcast", async () => {
      const broadcast = await prisma.broadcast.findFirst({
        where: { id: broadcastId, organizationId },
        select: {
          status: true,
          trackingId: true,
          templateName: true,
          templateLanguage: true,
          templateCategory: true,
          templateVariables: true,
        },
      });
      if (
        !broadcast ||
        broadcast.status !== "SENDING" ||
        !broadcast.templateName ||
        !broadcast.templateLanguage ||
        !broadcast.templateCategory
      ) {
        return { ready: false as const };
      }
      const mapping = broadcastTemplateMappingSchema.parse(
        broadcast.templateVariables ?? { header: [], body: [] },
      );
      return {
        ready: true as const,
        trackingId: broadcast.trackingId,
        config: {
          templateName: broadcast.templateName,
          languageCode: broadcast.templateLanguage,
          category: broadcast.templateCategory,
          mapping,
        } satisfies BroadcastSendConfig,
      };
    });

    if (!setup.ready) {
      return { skipped: true, reason: "broadcast-not-sending" };
    }

    // Credenciais resolvidas fora de step.run pra não persistir o token
    // decifrado no state do Inngest. Re-resolvido a cada checkpoint (barato).
    const credentials = await resolveCampaignMetaCredentials(
      setup.trackingId,
      organizationId,
    );

    for (let batchIndex = 0; batchIndex < MAX_BATCHES; batchIndex++) {
      const processed = await step.run(`send-batch-${batchIndex}`, async () => {
        const recipients = await prisma.broadcastRecipient.findMany({
          where: { broadcastId, status: "PENDING" },
          take: BATCH_SIZE,
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, phone: true, variables: true },
        });
        if (recipients.length === 0) return 0;

        for (const recipient of recipients) {
          try {
            const wamid = await sendBroadcastMessage(
              credentials,
              setup.config,
              recipient,
            );
            await prisma.broadcastRecipient.update({
              where: { id: recipient.id },
              data: {
                status: "SENT",
                externalMessageId: wamid,
                sentAt: new Date(),
                errorCode: null,
                errorMessage: null,
              },
            });
          } catch (error) {
            await prisma.broadcastRecipient.update({
              where: { id: recipient.id },
              data: {
                status: "FAILED",
                errorCode: "SEND_FAILED",
                errorMessage:
                  error instanceof Error
                    ? error.message.slice(0, 500)
                    : String(error).slice(0, 500),
              },
            });
          }
        }

        await recomputeBroadcastCounters(broadcastId);
        return recipients.length;
      });

      if (processed === 0) break;
    }

    await step.run("finalize", async () => {
      const sent = await prisma.broadcastRecipient.count({
        where: { broadcastId, status: { in: [...SENT_STATUSES] } },
      });
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: sent === 0 ? "FAILED" : "SENT",
          completedAt: new Date(),
        },
      });
      await recomputeBroadcastCounters(broadcastId);
    });

    return { done: true };
  },
);
