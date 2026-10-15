import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  EMAIL_CAMPAIGN_SEND_EVENT,
  failEmailCampaign,
  finishEmailCampaign,
  sendNextEmailBatch,
} from "@/features/campanhas/email/send-campaign-batch";

// 5.000 destinatários por disparo em lotes de 100: 50 lotes. O teto só impede laço infinito.
const MAX_BATCHES = 60;

// Spec 0107: disparo de email em lotes; cada lote é um step (retry não reenvia o que já saiu).
export const sendEmailCampaign = inngest.createFunction(
  {
    id: "campanhas-email-send",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.campaignId" },
    onFailure: async ({ event, error }) => {
      const { campaignId } = event.data.event.data as { campaignId: string };
      await failEmailCampaign(campaignId, error.message);
    },
  },
  { event: EMAIL_CAMPAIGN_SEND_EVENT },
  async ({ event, step }) => {
    const { campaignId } = event.data as { campaignId: string };
    await step.run("start", () =>
      prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: "sending" } }),
    );
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const { hasMore } = await step.run(`batch-${batch}`, () => sendNextEmailBatch(campaignId));
      if (!hasMore) break;
    }
    await step.run("finish", () => finishEmailCampaign(campaignId));
    return { campaignId };
  },
);
