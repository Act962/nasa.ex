import { inngest } from "@/inngest/client";
import {
  AWAIT_REPLY_CHECK_EVENT,
  AWAIT_REPLY_DELAY_MINUTES,
  applyAwaitingTagIfStillUnanswered,
} from "@/features/org-defaults/lib/auto-tags";

type AwaitReplyCheckEvent = { organizationId: string; leadId: string; inboundAt: string };

// 15 min após a mensagem do cliente: se ninguém respondeu, "Aguard. atendimento" (spec 0042, RF-4).
export const awaitReplyTagCheck = inngest.createFunction(
  {
    id: "org-defaults-await-reply-tag",
    retries: 2,
    // Várias mensagens seguidas do mesmo lead: um check só basta.
    debounce: { key: "event.data.leadId", period: "1m" },
  },
  { event: AWAIT_REPLY_CHECK_EVENT },
  async ({ event, step }) => {
    const data = event.data as AwaitReplyCheckEvent;
    const fireAt = new Date(new Date(data.inboundAt).getTime() + AWAIT_REPLY_DELAY_MINUTES * 60_000);
    await step.sleepUntil("aguarda-prazo-de-resposta", fireAt);
    return step.run("aplica-tag-se-sem-resposta", () => applyAwaitingTagIfStillUnanswered(data));
  },
);
