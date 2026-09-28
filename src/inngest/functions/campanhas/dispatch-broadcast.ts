import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resolveCampaignMetaCredentials } from "@/features/campanhas/server/lib/broadcast-access";
import {
  sendBroadcastMessage,
  type BroadcastSendConfig,
} from "@/features/campanhas/server/lib/broadcast-sender";
import { recomputeBroadcastCounters } from "@/features/campanhas/server/lib/broadcast-counters";
import { broadcastTemplateMappingSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { nextQuotaReleaseAt, remainingDailyContacts, resolveNumberMessagingLimit } from "@/features/campanhas/server/lib/daily-quota";

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

    // Limite diário da Meta (contatos únicos/24h): número novo começa em 250 e
    // sobe aos poucos. Campanha maior que o saldo do dia espera e continua
    // nas próximas horas, em vez de ser recusada pela Meta (spec 0040, RF-7).
    const limitLevel = await step.run("resolve-messaging-limit", () => resolveNumberMessagingLimit(credentials));

    for (let batchIndex = 0; batchIndex < MAX_BATCHES; batchIndex++) {
      const quota = await step.run(`daily-quota-${batchIndex}`, () => remainingDailyContacts(setup.trackingId, limitLevel));
      if (quota !== null && quota <= 0) {
        // Continua numa execução nova quando o limite liberar: esperar aqui
        // estouraria o teto de passos do Inngest em campanhas de vários dias.
        const resumeAt = await step.run("next-quota-release", () => nextQuotaReleaseAt(setup.trackingId));
        await step.sendEvent("continue-when-quota-frees", {
          name: "campanhas/broadcast.send",
          data: { broadcastId, organizationId },
          ts: new Date(resumeAt).getTime(),
        });
        return { paused: true, resumeAt };
      }
      const batchSize = quota === null ? BATCH_SIZE : Math.min(BATCH_SIZE, quota);
      const processed = await step.run(`send-batch-${batchIndex}`, async () => {
        const recipients = await prisma.broadcastRecipient.findMany({
          where: { broadcastId, status: "PENDING" },
          take: batchSize,
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
