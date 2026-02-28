"use server";

import { temperatureChannel } from "@/inngest/channels/temperature";
import { inngest } from "@/inngest/client";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";

export type TemperatureToken = Realtime.Token<
  typeof temperatureChannel,
  ["status"]
>;

export async function fetchTemperatureRealtimeToken(): Promise<TemperatureToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: temperatureChannel(),
    topics: ["status"],
  });

  return token;
}
