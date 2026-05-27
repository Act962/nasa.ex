import { channel, topic } from "@inngest/realtime";

/**
 * Channel compartilhado pelas 7 actions da categoria "Adicionar Lead
 * no App" (SEND_FORM, SEND_AGENDA, SEND_PROPOSAL, SEND_CONTRACT,
 * SEND_LINNKER, SEND_NBOX, SEND_NASA_ROUTE).
 *
 * Topic `status` propaga {loading | success | error} pro client
 * atualizar visual do node no canvas em tempo real.
 *
 * Mesma estrutura do `sendMessageChannel` — só renomeado por contexto.
 */
export const SEND_APP_ACTION_CHANNEL_NAME = "send-app-action-execution";

export const sendAppActionChannel = channel(
  SEND_APP_ACTION_CHANNEL_NAME,
).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
