/**
 * Meta Ads Management HTTP layer.
 *
 * Wraps Graph API v19.0 calls for:
 *  - Listing/CRUD de campaigns, adsets e ads
 *  - Insights drill-down (campaign/adset/ad)
 *
 * Recebe credenciais do PlatformIntegration.config (accessToken + adAccountId).
 * Não depende de oRPC — é puro fetch para ser usado em procedures e crons.
 */

const API_VERSION = "v19.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export interface MetaAuth {
  accessToken: string;
  adAccountId: string; // com ou sem prefixo "act_"
}

function actId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

async function graphFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json()) as Record<string, unknown>;
  if (json.error) {
    const err = json.error as { message: string; code: number; type: string };
    throw new Error(`[MetaAds] ${err.type ?? "Error"}: ${err.message}`);
  }
  return json as T;
}

// ─── Insights drill-down ──────────────────────────────────────────────────

const INSIGHTS_FIELDS = [
  "campaign_id", "campaign_name",
  "adset_id", "adset_name",
  "ad_id", "ad_name",
  "reach", "impressions", "frequency",
  "clicks", "ctr", "inline_post_engagement",
  "spend", "cpm", "cpc", "cpp",
  "conversions", "conversion_values",
  "video_play_actions", "video_thruplay_watched_actions",
  "video_avg_time_watched_actions",
  "actions", "cost_per_action_type", "cost_per_conversion",
].join(",");

export interface InsightRow {
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  reach: number;
  impressions: number;
  frequency: number;
  clicks: number;
  ctr: number;
  engagement: number;
  spend: number;
  cpm: number;
  cpc: number;
  cpp: number;
  cpl: number;
  cpa: number;
  cpv: number;
  conversions: number;
  leads: number;
  conversionValue: number;
  conversionRate: number;
  roas: number;
  videoPlays: number;
  thruPlays: number;
  avgWatchTime: number;
}

function parseInsightRow(raw: Record<string, unknown>): InsightRow {
  const reach = Number(raw.reach ?? 0);
  const impressions = Number(raw.impressions ?? 0);
  const frequency = Number(raw.frequency ?? 0);
  const clicks = Number(raw.clicks ?? 0);
  const ctr = Number(raw.ctr ?? 0);
  const spend = Number(raw.spend ?? 0);
  const cpm = Number(raw.cpm ?? 0);
  const cpc = Number(raw.cpc ?? 0);
  const cpp = Number(raw.cpp ?? 0);
  const engagement = Number(raw.inline_post_engagement ?? 0);

  const actions = (raw.actions as { action_type: string; value: string }[]) ?? [];
  const getAction = (type: string) => Number(actions.find((a) => a.action_type === type)?.value ?? 0);

  const conversions =
    getAction("offsite_conversion.fb_pixel_purchase") ||
    getAction("omni_purchase") ||
    getAction("lead") ||
    actions
      .filter((a) => a.action_type.startsWith("offsite_conversion"))
      .reduce((s, a) => s + Number(a.value), 0);
  const leads = getAction("lead");
  const conversionValue = Number(
    (raw.conversion_values as { value: string }[])?.[0]?.value ?? 0,
  );
  const roas = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0;
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;

  const videoPlays = getAction("video_play");
  const thruPlays = Number(
    (raw.video_thruplay_watched_actions as { value: string }[])?.[0]?.value ?? 0,
  );
  const avgWatchTime = Number(
    (raw.video_avg_time_watched_actions as { value: string }[])?.[0]?.value ?? 0,
  );

  return {
    campaignId: raw.campaign_id as string | undefined,
    campaignName: raw.campaign_name as string | undefined,
    adsetId: raw.adset_id as string | undefined,
    adsetName: raw.adset_name as string | undefined,
    adId: raw.ad_id as string | undefined,
    adName: raw.ad_name as string | undefined,
    reach, impressions, frequency,
    clicks, ctr, engagement,
    spend, cpm, cpc, cpp, cpl, cpa,
    cpv: videoPlays > 0 ? spend / videoPlays : 0,
    conversions, leads, conversionValue, conversionRate, roas,
    videoPlays, thruPlays, avgWatchTime,
  };
}

export async function fetchAdsInsights(
  auth: MetaAuth,
  opts: {
    level: "account" | "campaign" | "adset" | "ad";
    datePreset?: string;
    timeRange?: { since: string; until: string };
  },
): Promise<InsightRow[]> {
  const dateParam = opts.timeRange
    ? `time_range=${encodeURIComponent(JSON.stringify(opts.timeRange))}`
    : `date_preset=${opts.datePreset ?? "last_30d"}`;

  const url = `${GRAPH}/${actId(auth.adAccountId)}/insights?fields=${INSIGHTS_FIELDS}&${dateParam}&level=${opts.level}&limit=500&access_token=${auth.accessToken}`;
  const json = await graphFetch<{ data: Record<string, unknown>[] }>(url);
  return (json.data ?? []).map(parseInsightRow);
}

// ─── Campaigns ────────────────────────────────────────────────────────────

const CAMPAIGN_FIELDS = [
  "id", "name", "objective", "status", "effective_status",
  "special_ad_categories", "buying_type",
  "daily_budget", "lifetime_budget", "bid_strategy",
  "start_time", "stop_time",
].join(",");

export interface MetaCampaignRaw {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  special_ad_categories?: string[];
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  start_time?: string;
  stop_time?: string;
}

export async function listMetaCampaigns(auth: MetaAuth): Promise<MetaCampaignRaw[]> {
  const url = `${GRAPH}/${actId(auth.adAccountId)}/campaigns?fields=${CAMPAIGN_FIELDS}&limit=500&access_token=${auth.accessToken}`;
  const json = await graphFetch<{ data: MetaCampaignRaw[] }>(url);
  return json.data ?? [];
}

export async function createMetaCampaign(
  auth: MetaAuth,
  body: {
    name: string;
    objective: string; // ex: OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_SALES
    status?: "PAUSED" | "ACTIVE";
    specialAdCategories?: string[];
    dailyBudget?: number; // em centavos
    lifetimeBudget?: number;
    bidStrategy?: string;
    startTime?: string;
    stopTime?: string;
  },
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    name: body.name,
    objective: body.objective,
    status: body.status ?? "PAUSED",
    special_ad_categories: JSON.stringify(body.specialAdCategories ?? []),
    access_token: auth.accessToken,
  });
  if (body.dailyBudget) params.set("daily_budget", String(body.dailyBudget));
  if (body.lifetimeBudget) params.set("lifetime_budget", String(body.lifetimeBudget));
  if (body.bidStrategy) params.set("bid_strategy", body.bidStrategy);
  if (body.startTime) params.set("start_time", body.startTime);
  if (body.stopTime) params.set("stop_time", body.stopTime);

  return graphFetch<{ id: string }>(
    `${GRAPH}/${actId(auth.adAccountId)}/campaigns`,
    { method: "POST", body: params },
  );
}

export async function updateMetaCampaign(
  auth: MetaAuth,
  campaignId: string,
  patch: Partial<{
    name: string;
    status: "PAUSED" | "ACTIVE" | "ARCHIVED" | "DELETED";
    dailyBudget: number;
    lifetimeBudget: number;
    bidStrategy: string;
    startTime: string;
    stopTime: string;
  }>,
): Promise<{ success: boolean }> {
  const params = new URLSearchParams({ access_token: auth.accessToken });
  if (patch.name) params.set("name", patch.name);
  if (patch.status) params.set("status", patch.status);
  if (patch.dailyBudget) params.set("daily_budget", String(patch.dailyBudget));
  if (patch.lifetimeBudget) params.set("lifetime_budget", String(patch.lifetimeBudget));
  if (patch.bidStrategy) params.set("bid_strategy", patch.bidStrategy);
  if (patch.startTime) params.set("start_time", patch.startTime);
  if (patch.stopTime) params.set("stop_time", patch.stopTime);

  return graphFetch<{ success: boolean }>(`${GRAPH}/${campaignId}`, {
    method: "POST",
    body: params,
  });
}

export async function deleteMetaCampaign(
  auth: MetaAuth,
  campaignId: string,
): Promise<{ success: boolean }> {
  return graphFetch<{ success: boolean }>(
    `${GRAPH}/${campaignId}?access_token=${auth.accessToken}`,
    { method: "DELETE" },
  );
}

// ─── Ad Sets ──────────────────────────────────────────────────────────────

const ADSET_FIELDS = [
  "id", "name", "campaign_id", "status", "effective_status",
  "optimization_goal", "billing_event", "bid_amount",
  "daily_budget", "lifetime_budget",
  "targeting", "start_time", "end_time",
].join(",");

export interface MetaAdSetRaw {
  id: string;
  name: string;
  campaign_id: string;
  status?: string;
  effective_status?: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_amount?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export async function listMetaAdSets(auth: MetaAuth, campaignId?: string): Promise<MetaAdSetRaw[]> {
  const path = campaignId
    ? `${GRAPH}/${campaignId}/adsets`
    : `${GRAPH}/${actId(auth.adAccountId)}/adsets`;
  const url = `${path}?fields=${ADSET_FIELDS}&limit=500&access_token=${auth.accessToken}`;
  const json = await graphFetch<{ data: MetaAdSetRaw[] }>(url);
  return json.data ?? [];
}

export async function createMetaAdSet(
  auth: MetaAuth,
  body: {
    name: string;
    campaignId: string;
    optimizationGoal: string; // ex: LEAD_GENERATION, REACH, LINK_CLICKS
    billingEvent: string;     // ex: IMPRESSIONS, LINK_CLICKS
    dailyBudget?: number;
    lifetimeBudget?: number;
    bidAmount?: number;
    targeting: Record<string, unknown>; // exigido pela Meta
    startTime?: string;
    endTime?: string;
    status?: "PAUSED" | "ACTIVE";
  },
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    name: body.name,
    campaign_id: body.campaignId,
    optimization_goal: body.optimizationGoal,
    billing_event: body.billingEvent,
    targeting: JSON.stringify(body.targeting),
    status: body.status ?? "PAUSED",
    access_token: auth.accessToken,
  });
  if (body.dailyBudget) params.set("daily_budget", String(body.dailyBudget));
  if (body.lifetimeBudget) params.set("lifetime_budget", String(body.lifetimeBudget));
  if (body.bidAmount) params.set("bid_amount", String(body.bidAmount));
  if (body.startTime) params.set("start_time", body.startTime);
  if (body.endTime) params.set("end_time", body.endTime);

  return graphFetch<{ id: string }>(
    `${GRAPH}/${actId(auth.adAccountId)}/adsets`,
    { method: "POST", body: params },
  );
}

export async function updateMetaAdSet(
  auth: MetaAuth,
  adsetId: string,
  patch: Partial<{
    name: string;
    status: "PAUSED" | "ACTIVE" | "ARCHIVED" | "DELETED";
    dailyBudget: number;
    lifetimeBudget: number;
    bidAmount: number;
    targeting: Record<string, unknown>;
    startTime: string;
    endTime: string;
  }>,
): Promise<{ success: boolean }> {
  const params = new URLSearchParams({ access_token: auth.accessToken });
  if (patch.name) params.set("name", patch.name);
  if (patch.status) params.set("status", patch.status);
  if (patch.dailyBudget) params.set("daily_budget", String(patch.dailyBudget));
  if (patch.lifetimeBudget) params.set("lifetime_budget", String(patch.lifetimeBudget));
  if (patch.bidAmount) params.set("bid_amount", String(patch.bidAmount));
  if (patch.targeting) params.set("targeting", JSON.stringify(patch.targeting));
  if (patch.startTime) params.set("start_time", patch.startTime);
  if (patch.endTime) params.set("end_time", patch.endTime);

  return graphFetch<{ success: boolean }>(`${GRAPH}/${adsetId}`, {
    method: "POST",
    body: params,
  });
}

export async function deleteMetaAdSet(
  auth: MetaAuth,
  adsetId: string,
): Promise<{ success: boolean }> {
  return graphFetch<{ success: boolean }>(
    `${GRAPH}/${adsetId}?access_token=${auth.accessToken}`,
    { method: "DELETE" },
  );
}

// ─── Ads ──────────────────────────────────────────────────────────────────

const AD_FIELDS = [
  "id", "name", "campaign_id", "adset_id",
  "status", "effective_status", "creative", "preview_shareable_link",
].join(",");

export interface MetaAdRaw {
  id: string;
  name: string;
  campaign_id: string;
  adset_id: string;
  status?: string;
  effective_status?: string;
  creative?: { id: string };
  preview_shareable_link?: string;
}

export async function listMetaAds(
  auth: MetaAuth,
  filter?: { campaignId?: string; adsetId?: string },
): Promise<MetaAdRaw[]> {
  const path = filter?.adsetId
    ? `${GRAPH}/${filter.adsetId}/ads`
    : filter?.campaignId
      ? `${GRAPH}/${filter.campaignId}/ads`
      : `${GRAPH}/${actId(auth.adAccountId)}/ads`;
  const url = `${path}?fields=${AD_FIELDS}&limit=500&access_token=${auth.accessToken}`;
  const json = await graphFetch<{ data: MetaAdRaw[] }>(url);
  return json.data ?? [];
}

export async function createMetaAd(
  auth: MetaAuth,
  body: {
    name: string;
    adsetId: string;
    creativeId: string; // criar via /act_X/adcreatives previamente
    status?: "PAUSED" | "ACTIVE";
  },
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    name: body.name,
    adset_id: body.adsetId,
    creative: JSON.stringify({ creative_id: body.creativeId }),
    status: body.status ?? "PAUSED",
    access_token: auth.accessToken,
  });
  return graphFetch<{ id: string }>(
    `${GRAPH}/${actId(auth.adAccountId)}/ads`,
    { method: "POST", body: params },
  );
}

export async function updateMetaAd(
  auth: MetaAuth,
  adId: string,
  patch: Partial<{
    name: string;
    status: "PAUSED" | "ACTIVE" | "ARCHIVED" | "DELETED";
    creativeId: string;
  }>,
): Promise<{ success: boolean }> {
  const params = new URLSearchParams({ access_token: auth.accessToken });
  if (patch.name) params.set("name", patch.name);
  if (patch.status) params.set("status", patch.status);
  if (patch.creativeId) params.set("creative", JSON.stringify({ creative_id: patch.creativeId }));

  return graphFetch<{ success: boolean }>(`${GRAPH}/${adId}`, {
    method: "POST",
    body: params,
  });
}

export async function deleteMetaAd(
  auth: MetaAuth,
  adId: string,
): Promise<{ success: boolean }> {
  return graphFetch<{ success: boolean }>(
    `${GRAPH}/${adId}?access_token=${auth.accessToken}`,
    { method: "DELETE" },
  );
}

// ─── Ad Creatives (helper para criar creative antes do ad) ────────────────

export async function createMetaAdCreative(
  auth: MetaAuth,
  body: {
    name: string;
    pageId: string;
    instagramActorId?: string;
    objectStorySpec?: Record<string, unknown>;
    linkData?: { link: string; message: string; name?: string; description?: string; imageHash?: string };
  },
): Promise<{ id: string }> {
  const spec = body.objectStorySpec ?? {
    page_id: body.pageId,
    ...(body.instagramActorId ? { instagram_actor_id: body.instagramActorId } : {}),
    ...(body.linkData
      ? {
          link_data: {
            link: body.linkData.link,
            message: body.linkData.message,
            ...(body.linkData.name ? { name: body.linkData.name } : {}),
            ...(body.linkData.description ? { description: body.linkData.description } : {}),
            ...(body.linkData.imageHash ? { image_hash: body.linkData.imageHash } : {}),
          },
        }
      : {}),
  };

  const params = new URLSearchParams({
    name: body.name,
    object_story_spec: JSON.stringify(spec),
    access_token: auth.accessToken,
  });
  return graphFetch<{ id: string }>(
    `${GRAPH}/${actId(auth.adAccountId)}/adcreatives`,
    { method: "POST", body: params },
  );
}
