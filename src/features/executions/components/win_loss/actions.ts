"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { winLossChannel } from "@/inngest/channels/win-loss";

export type WinLossToken = Realtime.Token<typeof winLossChannel, ["status"]>;

export async function fetchWinLossRealtimeToken(): Promise<WinLossToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: winLossChannel(),
    topics: ["status"],
  });

  return token;
}
