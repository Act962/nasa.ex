/**
 * Caixa de entrada Gmail do financeiro (spec 0018).
 *
 * O ticker horário só distribui: um evento `payment/inbox.sync` por org com a
 * caixa ativa e integração Google conectada. A função por org serializa (limit 1) e
 * ingere cada anexo num `step.run` próprio, pra que uma falha não refaça — nem
 * recobre — os documentos que já passaram.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  discoverOrgInboxItems,
  finishOrgInboxSync,
} from "@/features/payment/server/inbox/sync-org-inbox";
import { ingestInboxItem } from "@/features/payment/server/inbox/ingest-inbox-attachment";
import { resolveInboxActorUserId } from "@/features/payment/server/inbox/inbox-service";
import {
  PAYMENT_INBOX_SYNC_EVENT,
  type PaymentInboxSyncEventData,
} from "@/features/payment/server/inbox/inbox-constants";

// Distribuição horária: roda dentro do `polling-ticker-hourly` (sem cron próprio, sem steps).
export async function runPaymentInboxSyncDispatch() {
  const configs = await prisma.paymentInboxConfig.findMany({
    where: {
      isEnabled: true,
      organization: {
        platformIntegrations: { some: { platform: "GMAIL", isActive: true } },
      },
    },
    select: { organizationId: true },
  });
  if (configs.length === 0) return { dispatched: 0 };

  await inngest.send(
    configs.map((config) => ({
      name: PAYMENT_INBOX_SYNC_EVENT,
      data: { organizationId: config.organizationId } satisfies PaymentInboxSyncEventData,
    })),
  );
  return { dispatched: configs.length };
}

export const paymentInboxSyncOrg = inngest.createFunction(
  {
    id: "payment-inbox-sync-org",
    retries: 1,
    concurrency: { key: "event.data.organizationId", limit: 1 },
  },
  { event: PAYMENT_INBOX_SYNC_EVENT },
  async ({ event, step, logger }) => {
    const { organizationId, triggeredByUserId } = event.data as PaymentInboxSyncEventData;

    // Descobrir e resolver o autor numa etapa só; sem e-mail novo, fecha o sync ali mesmo (2 execuções).
    const discovery = await step.run("discover", async () => {
      const discovered = await discoverOrgInboxItems({ organizationId });
      if (!discovered.ok) return { ...discovered, actorUserId: null, finished: null };
      if (discovered.itemIds.length === 0) {
        const finished = await finishOrgInboxSync({
          organizationId,
          processedItemIds: [],
          accountEmail: discovered.accountEmail,
        });
        return { ...discovered, actorUserId: null, finished };
      }
      const actorUserId = await resolveInboxActorUserId({ organizationId, triggeredByUserId });
      return { ...discovered, actorUserId, finished: null };
    });
    if (!discovery.ok) {
      logger.warn("[payment-inbox-sync-org] sync pulado", { organizationId, reason: discovery.reason });
      return discovery;
    }
    if (discovery.finished) return { discovered: discovery.discoveredCount, ...discovery.finished };
    const actorUserId = discovery.actorUserId;

    const outcomes: Record<string, string> = {};
    for (const itemId of discovery.itemIds) {
      outcomes[itemId] = await step.run(`ingest-${itemId}`, () =>
        ingestInboxItem({ organizationId, itemId, actorUserId }),
      );
    }

    const finish = await step.run("finish", () =>
      finishOrgInboxSync({
        organizationId,
        processedItemIds: discovery.itemIds,
        accountEmail: discovery.accountEmail,
      }),
    );

    return { discovered: discovery.discoveredCount, outcomes, ...finish };
  },
);
