"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { sendAppActionChannel } from "@/inngest/channels/send-app-action";

/**
 * Token de subscription Realtime do canal compartilhado das 7 actions
 * "Adicionar Lead no App" (SEND_FORM, SEND_AGENDA, etc).
 *
 * Reusado por todos os 7 node components via `useNodeStatus` —
 * mesmo padrão que cada `fetchSendMessageRealtimeToken` do SEND_MESSAGE.
 */

export type SendAppActionToken = Realtime.Token<
  typeof sendAppActionChannel,
  ["status"]
>;

export async function fetchSendAppActionRealtimeToken(): Promise<SendAppActionToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: sendAppActionChannel(),
    topics: ["status"],
  });

  return token;
}
