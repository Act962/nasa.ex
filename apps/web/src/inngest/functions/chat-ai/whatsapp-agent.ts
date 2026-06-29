import { inngest } from "@/inngest/client";
import { runWhatsappAgent } from "@/features/tracking-chat-ai/lib/agent";
import type { AgentEventData } from "@/features/tracking-chat-ai/lib/context";

export const chatAiWhatsappAgent = inngest.createFunction(
  {
    id: "chat-ai-whatsapp-agent",
    retries: 2,
    debounce: { period: "3s", key: "event.data.leadId" },
    concurrency: { limit: 1, key: "event.data.leadId" },
  },
  { event: "chat/ai.whatsapp-message-received" },
  async ({ event, step }) => {
    return runWhatsappAgent({
      step,
      data: event.data as AgentEventData,
    });
  },
);
