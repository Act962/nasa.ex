"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { waitChannel } from "@/inngest/channels/wait";

export type WaitToken = Realtime.Token<typeof waitChannel, ["status"]>;

export async function fetchWaitRealtimeToken(): Promise<WaitToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: waitChannel(),
    topics: ["status"],
  });

  return token;
}
