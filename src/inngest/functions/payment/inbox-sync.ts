/**
 * Caixa de entrada Gmail do financeiro (spec 0018).
 *
 * O cron só distribui: um evento `payment/inbox.sync` por org com a caixa
 * ativa e integração Google conectada. A função por org serializa (limit 1) e
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

export const paymentInboxSyncCron = inngest.createFunction(
  { id: "payment-inbox-sync-cron", retries: 0 },
  { cron: "*/30 * * * *" },
  async ({ step, logger }) => {
    const organizationIds = await step.run("list-enabled-orgs", async () => {
      const configs = await prisma.paymentInboxConfig.findMany({
        where: {
          isEnabled: true,
          organization: {
            platformIntegrations: { some: { platform: "GMAIL", isActive: true } },
          },
        },
        select: { organizationId: true },
      });
      return configs.map((config) => config.organizationId);
    });

    if (organizationIds.length === 0) return { dispatched: 0 };

    await step.sendEvent(
      "fan-out-org-sync",
      organizationIds.map((organizationId) => ({
        name: PAYMENT_INBOX_SYNC_EVENT,
        data: { organizationId } satisfies PaymentInboxSyncEventData,
      })),
    );

    logger.info("[payment-inbox-sync-cron] orgs disparadas", { count: organizationIds.length });
    return { dispatched: organizationIds.length };
  },
);

export const paymentInboxSyncOrg = inngest.createFunction(
  {
    id: "payment-inbox-sync-org",
    retries: 1,
    concurrency: { key: "event.data.organizationId", limit: 1 },
  },
  { event: PAYMENT_INBOX_SYNC_EVENT },
  async ({ event, step, logger }) => {
    const { organizationId, triggeredByUserId } = event.data as PaymentInboxSyncEventData;

    const discovery = await step.run("discover", () => discoverOrgInboxItems({ organizationId }));
    if (!discovery.ok) {
      logger.warn("[payment-inbox-sync-org] sync pulado", { organizationId, reason: discovery.reason });
      return discovery;
    }

    const actorUserId = await step.run("resolve-actor", () =>
      resolveInboxActorUserId({ organizationId, triggeredByUserId }),
    );

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
