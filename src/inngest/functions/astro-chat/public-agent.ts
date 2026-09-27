import { inngest } from "@/inngest/client";
import {
  runAstroChatAgent,
  type AstroChatAgentEvent,
} from "@/features/astro-chat/server/agent/run-agent";

/** ASTRO CHAT: resposta ao visitante do site (spec 0031, RNF-2). */
export const astroChatPublicAgent = inngest.createFunction(
  {
    id: "astro-chat-public-agent",
    retries: 1,
    debounce: { period: "3s", key: "event.data.leadId" },
    concurrency: { limit: 1, key: "event.data.leadId" },
  },
  { event: "astro-chat/message-received" },
  async ({ event, step }) =>
    runAstroChatAgent({ step, event: event.data as AstroChatAgentEvent }),
);
