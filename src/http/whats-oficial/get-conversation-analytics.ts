"use server";

import { graphFetch } from "./client";
import { buildAnalyticsFieldsParam } from "./build-analytics-fields-param";
import type { ConversationAnalyticsResponse } from "./types";

interface GetConversationAnalyticsInput {
  wabaId: string;
  accessToken: string;
  startUnix: number;
  endUnix: number;
}

/**
 * Lê o número de conversas e o custo aproximado por categoria
 * (marketing/utility/authentication/service) num intervalo de datas.
 *
 * Endpoint Meta: `GET /v23.0/{waba_id}?fields=conversation_analytics.start(...).end(...).granularity(DAILY).dimensions([...])`.
 */
export async function getConversationAnalytics(
  input: GetConversationAnalyticsInput,
): Promise<ConversationAnalyticsResponse> {
  const fields = buildAnalyticsFieldsParam("conversation_analytics", {
    startUnix: input.startUnix,
    endUnix: input.endUnix,
    granularity: "DAILY",
    dimensions: ["CONVERSATION_CATEGORY", "CONVERSATION_TYPE"],
  });
  const path = `/${input.wabaId}?fields=${encodeURIComponent(fields)}`;
  return graphFetch<ConversationAnalyticsResponse>(path, {
    method: "GET",
    accessToken: input.accessToken,
  });
}
