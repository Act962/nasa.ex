"use server";

import { graphFetch } from "./client";
import { buildAnalyticsFieldsParam } from "./build-analytics-fields-param";

// Custo por mensagem entregue (cobrança da Meta desde jul/2025), por categoria
// e dia. Substitui `conversation_analytics` a partir dessa data (spec 0040).

export interface PricingAnalyticsDataPoint {
  start: number;
  end: number;
  volume?: number;
  cost?: number;
  pricing_category?: string;
  pricing_type?: string;
  country?: string;
}

export interface PricingAnalyticsResponse {
  pricing_analytics?: { data?: { data_points?: PricingAnalyticsDataPoint[] }[] };
  currency?: string;
  id?: string;
}

interface GetPricingAnalyticsInput {
  wabaId: string;
  accessToken: string;
  startUnix: number;
  endUnix: number;
}

export async function getPricingAnalytics(input: GetPricingAnalyticsInput): Promise<PricingAnalyticsResponse> {
  const fields = buildAnalyticsFieldsParam("pricing_analytics", {
    startUnix: input.startUnix,
    endUnix: input.endUnix,
    granularity: "DAILY",
    dimensions: ["PRICING_CATEGORY", "PRICING_TYPE"],
  });
  const path = `/${input.wabaId}?fields=${encodeURIComponent(`${fields},currency`)}`;
  return graphFetch<PricingAnalyticsResponse>(path, { method: "GET", accessToken: input.accessToken });
}
