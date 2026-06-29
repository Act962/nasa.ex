const GRAPH_API = "https://graph.facebook.com/v19.0";

export interface PostMetrics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  videoViews?: number;
}

export class MetaInsightsError extends Error {
  constructor(message: string, public readonly raw: unknown) {
    super(message);
  }
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data?.error?.message ?? `Graph API error (${res.status})`;
    throw new MetaInsightsError(msg, data);
  }
  return data;
}

// Instagram media insights — supports IMAGE, VIDEO, CAROUSEL_ALBUM, REELS
export async function fetchInstagramInsights(
  igMediaId: string,
  accessToken: string,
): Promise<PostMetrics> {
  const metrics = "impressions,reach,likes,comments,shares,video_views";
  const insightsUrl = `${GRAPH_API}/${igMediaId}/insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`;
  const detailsUrl = `${GRAPH_API}/${igMediaId}?fields=like_count,comments_count&access_token=${encodeURIComponent(accessToken)}`;

  const [insights, details] = await Promise.all([
    fetchJson(insightsUrl).catch((e) => {
      if (e instanceof MetaInsightsError) return { data: [] };
      throw e;
    }),
    fetchJson(detailsUrl).catch(() => ({})),
  ]);

  const out: PostMetrics = {};
  for (const m of insights.data ?? []) {
    const v = m.values?.[0]?.value;
    if (typeof v !== "number") continue;
    if (m.name === "impressions") out.impressions = v;
    if (m.name === "reach") out.reach = v;
    if (m.name === "likes") out.likes = v;
    if (m.name === "comments") out.comments = v;
    if (m.name === "shares") out.shares = v;
    if (m.name === "video_views") out.videoViews = v;
  }
  if (out.likes === undefined && typeof details.like_count === "number") out.likes = details.like_count;
  if (out.comments === undefined && typeof details.comments_count === "number") out.comments = details.comments_count;
  return out;
}

// Facebook Page post insights
export async function fetchFacebookInsights(
  fbPostId: string,
  accessToken: string,
): Promise<PostMetrics> {
  const metrics = "post_impressions,post_impressions_unique,post_reactions_by_type_total,post_video_views";
  const insightsUrl = `${GRAPH_API}/${fbPostId}/insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`;
  const detailsUrl = `${GRAPH_API}/${fbPostId}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0),shares&access_token=${encodeURIComponent(accessToken)}`;

  const [insights, details] = await Promise.all([
    fetchJson(insightsUrl).catch((e) => {
      if (e instanceof MetaInsightsError) return { data: [] };
      throw e;
    }),
    fetchJson(detailsUrl).catch(() => ({})),
  ]);

  const out: PostMetrics = {};
  for (const m of insights.data ?? []) {
    const v = m.values?.[0]?.value;
    if (m.name === "post_impressions" && typeof v === "number") out.impressions = v;
    if (m.name === "post_impressions_unique" && typeof v === "number") out.reach = v;
    if (m.name === "post_video_views" && typeof v === "number") out.videoViews = v;
    if (m.name === "post_reactions_by_type_total" && v && typeof v === "object") {
      out.likes = Object.values(v).reduce((sum: number, n) => sum + (typeof n === "number" ? n : 0), 0);
    }
  }
  if (typeof details?.likes?.summary?.total_count === "number") out.likes = details.likes.summary.total_count;
  if (typeof details?.comments?.summary?.total_count === "number") out.comments = details.comments.summary.total_count;
  if (typeof details?.shares?.count === "number") out.shares = details.shares.count;
  return out;
}
