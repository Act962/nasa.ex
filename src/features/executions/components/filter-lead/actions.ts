"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { filterLeadChannel } from "@/inngest/channels/filter-lead";

export type FilterLeadToken = Realtime.Token<typeof filterLeadChannel, ["status"]>;

export async function fetchFilterLeadRealtimeToken(): Promise<FilterLeadToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: filterLeadChannel(),
    topics: ["status"],
  });

  return token;
}
