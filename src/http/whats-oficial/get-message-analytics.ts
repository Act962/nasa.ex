"use server";

import { graphFetch } from "./client";
import { buildAnalyticsFieldsParam } from "./build-analytics-fields-param";
import type { MessageAnalyticsResponse } from "./types";

interface GetMessageAnalyticsInput {
  wabaId: string;
  accessToken: string;
  startUnix: number;
  endUnix: number;
}

/**
 * Lê o número de mensagens enviadas/entregues por número de telefone da WABA
 * num intervalo de datas, com detalhamento diário.
 *
 * Endpoint Meta: `GET /v23.0/{waba_id}?fields=analytics.start(...).end(...).granularity(DAY)`.
 */
export async function getMessageAnalytics(
  input: GetMessageAnalyticsInput,
): Promise<MessageAnalyticsResponse> {
  const fields = buildAnalyticsFieldsParam("analytics", {
    startUnix: input.startUnix,
    endUnix: input.endUnix,
    granularity: "DAY",
  });
  const path = `/${input.wabaId}?fields=${encodeURIComponent(fields)}`;
  return graphFetch<MessageAnalyticsResponse>(path, {
    method: "GET",
    accessToken: input.accessToken,
  });
}
