"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { sendMessageChannel } from "@/inngest/channels/send-message";

export type SendMessageToken = Realtime.Token<
  typeof sendMessageChannel,
  ["status"]
>;

export async function fetchSendMessageRealtimeToken(): Promise<SendMessageToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: sendMessageChannel(),
    topics: ["status"],
  });

  return token;
}
