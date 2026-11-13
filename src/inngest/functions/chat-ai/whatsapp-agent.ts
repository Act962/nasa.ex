import { inngest } from "@/inngest/client";
import { runWhatsappAgent } from "@/features/tracking-chat-ai/lib/agent";
import type { AgentEventData } from "@/features/tracking-chat-ai/lib/context";

// `checkpointing`: as etapas rodam em sequência na mesma chamada, avisando o Inngest a cada uma,
// em vez de o Inngest chamar o app de novo por etapa (e recarregar o contexto a cada volta).
// Era a maior parte da demora da resposta. Se a chamada cair, o Inngest volta ao modo normal.
export const chatAiWhatsappAgent = inngest.createFunction(
  {
    id: "chat-ai-whatsapp-agent",
    retries: 2,
    checkpointing: true,
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

// Toque em botão já é a mensagem inteira: roda sem a espera que junta mensagens digitadas em sequência.
export const chatAiWhatsappButtonClick = inngest.createFunction(
  {
    id: "chat-ai-whatsapp-button-click",
    retries: 2,
    checkpointing: true,
    concurrency: { limit: 1, key: "event.data.leadId" },
  },
  { event: "chat/ai.whatsapp-button-clicked" },
  async ({ event, step }) => {
    return runWhatsappAgent({
      step,
      data: event.data as AgentEventData,
    });
  },
);
