"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { responsibleChannel } from "@/inngest/channels/responsible";

export type ResponsibleToken = Realtime.Token<
  typeof responsibleChannel,
  ["status"]
>;

export async function fetchResponsibleRealtimeToken(): Promise<ResponsibleToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: responsibleChannel(),
    topics: ["status"],
  });

  return token;
}
