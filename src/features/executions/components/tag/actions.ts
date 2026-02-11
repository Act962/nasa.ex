"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { tagChannel } from "@/inngest/channels/tag";

export type TagToken = Realtime.Token<typeof tagChannel, ["status"]>;

export async function fetchTagRealtimeToken(): Promise<TagToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: tagChannel(),
    topics: ["status"],
  });

  return token;
}
