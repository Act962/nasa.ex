/**
 * Facebook Pages — Insights HTTP layer.
 *
 * Endpoint diferente da Marketing API (Ads) e da Instagram Graph API.
 * Aqui usamos `/{page-id}/insights` direto da Graph API com page access token.
 *
 * Escopos necessários: `pages_read_engagement` + `read_insights` (já no
 * `META_SCOPES` do projeto).
 *
 * Docs:
 *  - https://developers.facebook.com/docs/graph-api/reference/v22.0/insights
 *  - https://developers.facebook.com/docs/graph-api/reference/v22.0/page/insights
 *  - https://developers.facebook.com/docs/graph-api/reference/v22.0/post/insights
 */

import { META_GRAPH } from "./ads-management";

export interface FacebookPageSummary {
  /** Quantidade total de seguidores da página (snapshot atual). */
  followersCount: number;
  /** Crescimento líquido de seguidores no período (page_fan_adds - removes). */
  newFollowers: number;
  /** Alcance total único da página no período. */
  reachTotal: number;
  /** Total de visualizações da página no período. */
  pageViews: number;
}

export interface FacebookPost {
  id: string;
  message: string | null;
  permalinkUrl: string | null;
  fullPicture: string | null;
  createdTime: string;
  likes: number;
  comments: number;
  shares: number;
}

type InsightsResp = {
  data?: Array<{ name: string; values: Array<{ value: number; end_time?: string }> }>;
};
type PostsResp = {
  data?: Array<{
    id: string;
    message?: string;
    permalink_url?: string;
    full_picture?: string;
    created_time: string;
    likes?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
    shares?: { count?: number };
  }>;
};
type PageInfoResp = { id: string; fan_count?: number; followers_count?: number };

async function fbFetch<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as Record<string, unknown>;
  if (json.error) {
    const err = json.error as { message: string; code: number; type: string };
    throw new Error(`[FBPages] ${err.type ?? "Error"}: ${err.message}`);
  }
  return json as T;
}

/**
 * Resumo da Page no período: followers totais + novos + reach + page views.
 *
 * Usa duas chamadas:
 *  1. `/{page}?fields=fan_count,followers_count` — snapshot atual de seguidores.
 *  2. `/{page}/insights?metric=...` — métricas agregadas do período.
 */
export async function fetchFacebookPageSummary(
  pageId: string,
  pageAccessToken: string,
  since: Date,
  until: Date,
): Promise<FacebookPageSummary> {
  const sinceTs = Math.floor(since.getTime() / 1000);
  const untilTs = Math.floor(until.getTime() / 1000);

  // 1. Page info (followers atuais)
  let pageInfo: PageInfoResp = { id: pageId };
  try {
    pageInfo = await fbFetch<PageInfoResp>(
      `${META_GRAPH}/${pageId}?fields=fan_count,followers_count&access_token=${encodeURIComponent(pageAccessToken)}`,
    );
  } catch {
    // tolera — usa zeros nos campos
  }

  // 2. Insights do período (séries diárias somadas).
  const metrics = [
    "page_fan_adds_unique",
    "page_impressions_unique",
    "page_views_total",
  ].join(",");
  let insights: InsightsResp = {};
  try {
    insights = await fbFetch<InsightsResp>(
      `${META_GRAPH}/${pageId}/insights?` +
        `metric=${metrics}` +
        `&period=day` +
        `&since=${sinceTs}` +
        `&until=${untilTs}` +
        `&access_token=${encodeURIComponent(pageAccessToken)}`,
    );
  } catch {
    // ignora — métricas voltam zeradas
  }

  const sumMetric = (name: string): number =>
    (insights.data ?? [])
      .find((m) => m.name === name)
      ?.values.reduce((s, v) => s + (v.value ?? 0), 0) ?? 0;

  const followersCount =
    pageInfo.followers_count ?? pageInfo.fan_count ?? 0;

  return {
    followersCount,
    newFollowers: sumMetric("page_fan_adds_unique"),
    reachTotal: sumMetric("page_impressions_unique"),
    pageViews: sumMetric("page_views_total"),
  };
}

/**
 * Top N posts da Page por engajamento (likes + comments + shares).
 * Não chama /insights por post pra economizar quota.
 */
export async function fetchFacebookTopPosts(
  pageId: string,
  pageAccessToken: string,
  limit = 6,
): Promise<FacebookPost[]> {
  const fields = [
    "id",
    "message",
    "permalink_url",
    "full_picture",
    "created_time",
    "likes.summary(true).limit(0)",
    "comments.summary(true).limit(0)",
    "shares",
  ].join(",");

  const url =
    `${META_GRAPH}/${pageId}/posts?` +
    `fields=${fields}` +
    `&limit=${Math.min(50, limit * 3)}` +
    `&access_token=${encodeURIComponent(pageAccessToken)}`;

  let resp: PostsResp = {};
  try {
    resp = await fbFetch<PostsResp>(url);
  } catch {
    return [];
  }

  const items = (resp.data ?? []).map((p) => ({
    id: p.id,
    message: p.message ?? null,
    permalinkUrl: p.permalink_url ?? null,
    fullPicture: p.full_picture ?? null,
    createdTime: p.created_time,
    likes: p.likes?.summary?.total_count ?? 0,
    comments: p.comments?.summary?.total_count ?? 0,
    shares: p.shares?.count ?? 0,
  }));

  items.sort(
    (a, b) =>
      b.likes + b.comments + b.shares - (a.likes + a.comments + a.shares),
  );

  return items.slice(0, limit);
}
