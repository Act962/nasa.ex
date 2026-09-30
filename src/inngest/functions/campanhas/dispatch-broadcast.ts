import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resolveCampaignMetaCredentials } from "@/features/campanhas/server/lib/broadcast-access";
import {
  sendBroadcastMessage,
  type BroadcastSendConfig,
  type BroadcastSendResult,
} from "@/features/campanhas/server/lib/broadcast-sender";
import { recomputeBroadcastCounters } from "@/features/campanhas/server/lib/broadcast-counters";
import {
  recordBroadcastChatMessage,
  type BroadcastTemplateTexts,
} from "@/features/campanhas/server/lib/record-broadcast-chat-message";
import { getMessageTemplates } from "@/http/whats-oficial";
import { broadcastTemplateMappingSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { nextQuotaReleaseAt, remainingDailyContacts, resolveNumberMessagingLimit } from "@/features/campanhas/server/lib/daily-quota";

/**
 * Handler de disparo em massa (Fase 3). Consome `campanhas/broadcast.send`,
 * processa os destinatários `PENDING` em lotes duráveis (`step.run`), grava o
 * `wamid`/erro em cada um e recomputa os contadores do broadcast a cada lote.
 * Contadores são recalculados por contagem (não incremento) → idempotente em
 * retries. Concorrência limitada por organização pra respeitar os limites Meta.
 * Cada envio bem-sucedido também vira mensagem no chat do tracking (spec 0052).
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
          name: true,
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
        name: broadcast.name,
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

    // Texto do template pra espelhar no chat. Falhar aqui não impede o disparo:
    // só deixa de gravar a mensagem na conversa.
    const templateTexts = await step.run(
      "load-template-texts",
      async (): Promise<BroadcastTemplateTexts | null> => {
        try {
          const { data: templates } = await getMessageTemplates(
            credentials.accessToken,
            credentials.wabaId,
          );
          const template = templates.find(
            (item) =>
              item.name === setup.config.templateName &&
              item.language === setup.config.languageCode,
          );
          if (!template) return null;
          const header = template.components.find(
            (component) => component.type === "HEADER",
          );
          return {
            headerText:
              header && (header.format ?? "TEXT") === "TEXT" ? header.text ?? null : null,
            bodyText:
              template.components.find((component) => component.type === "BODY")
                ?.text ?? "",
          };
        } catch (error) {
          console.warn("[campanhas] template texts unavailable", error);
          return null;
        }
      },
    );

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
          select: { id: true, leadId: true, name: true, phone: true, variables: true },
        });
        if (recipients.length === 0) return 0;

        for (const recipient of recipients) {
          let sent: BroadcastSendResult;
          try {
            sent = await sendBroadcastMessage(credentials, setup.config, recipient);
            await prisma.broadcastRecipient.update({
              where: { id: recipient.id },
              data: {
                status: "SENT",
                externalMessageId: sent.wamid,
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
            continue;
          }

          if (!templateTexts) continue;
          await recordBroadcastChatMessage({
            trackingId: setup.trackingId,
            broadcastId,
            broadcastName: setup.name,
            templateName: setup.config.templateName,
            templateTexts,
            recipient,
            sent,
          }).catch((error: unknown) => {
            console.error("[campanhas] chat mirror failed", {
              broadcastId,
              recipientId: recipient.id,
              error,
            });
          });
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
