"use server";

import { moveLeadChannel } from "@/inngest/channels/move-lead";
import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";

export type MoveLeadToken = Realtime.Token<typeof moveLeadChannel, ["status"]>;

export async function fetchMoveLeadRealtimeToken(): Promise<MoveLeadToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: moveLeadChannel(),
    topics: ["status"],
  });

  return token;
}
