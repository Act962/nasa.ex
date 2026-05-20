/**
 * Instagram Graph API — Insights HTTP layer.
 *
 * Endpoint diferente da Marketing API (que cobre Ads). Aqui usamos a
 * Graph API direto no `{ig-user-id}` (Business Account) e `{ig-media-id}`.
 *
 * Auth: usa **Page Access Token** (vem de `pages[].access_token` salvo no
 * config da integração Meta). User token NÃO tem permissão pra IG insights.
 *
 * Docs:
 *  - https://developers.facebook.com/docs/instagram-api/reference/ig-user/insights
 *  - https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
 */

import { META_GRAPH } from "./ads-management";

export interface InstagramAccountSummary {
  followersCount: number;
  /** Total de visualizações totais (impressions+reels views) — agregado do período. */
  totalViews: number;
  profileViews: number;
  reachTotal: number;
  /** Soma de `saved` em todas as mídias do período. */
  savedTotal: number;
  /** Engajamento de Reels (likes+comments+shares+saves / plays). */
  reelsInteractionRate: number;
}

export interface InstagramMedia {
  id: string;
  caption: string | null;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  /** Só VIDEO/REEL. */
  viewsCount: number;
  /** Só VIDEO/REEL. */
  saved: number;
}

type MetricValue = { value: number; end_time?: string };
type IgInsightsResp = {
  data?: Array<{ name: string; values: MetricValue[] }>;
};
type IgMediaListResp = {
  data?: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_product_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
  }>;
};

async function igFetch<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as Record<string, unknown>;
  if (json.error) {
    const err = json.error as { message: string; code: number; type: string };
    throw new Error(`[IG] ${err.type ?? "Error"}: ${err.message}`);
  }
  return json as T;
}

/**
 * Resumo do account: followers + reach/impressions/profile_views agregados.
 * Period=day, since/until em UNIX timestamp (Meta API exige).
 */
export async function fetchInstagramAccountSummary(
  igUserId: string,
  pageAccessToken: string,
  since: Date,
  until: Date,
): Promise<InstagramAccountSummary> {
  const sinceTs = Math.floor(since.getTime() / 1000);
  const untilTs = Math.floor(until.getTime() / 1000);

  // 1. Followers totais (snapshot atual, não série) + profile/reach do período
  const metrics = ["follower_count", "reach", "profile_views"].join(",");
  const insightsUrl =
    `${META_GRAPH}/${igUserId}/insights?` +
    `metric=${metrics}` +
    `&period=day` +
    `&since=${sinceTs}` +
    `&until=${untilTs}` +
    `&access_token=${encodeURIComponent(pageAccessToken)}`;

  let insights: IgInsightsResp = {};
  try {
    insights = await igFetch<IgInsightsResp>(insightsUrl);
  } catch {
    // Métricas insights podem falhar se a conta não tem dados ou não é
    // Business — degrade graciosamente.
  }

  const sumMetric = (name: string): number =>
    (insights.data ?? [])
      .find((m) => m.name === name)
      ?.values.reduce((s, v) => s + (v.value ?? 0), 0) ?? 0;

  // followers_count vem como série diária; pegamos o último valor (snapshot atual).
  const lastFollowers =
    (insights.data ?? [])
      .find((m) => m.name === "follower_count")
      ?.values.at(-1)?.value ?? 0;

  return {
    followersCount: lastFollowers,
    totalViews: 0, // computado a partir das mídias depois (cheaper que /insights?metric=views)
    profileViews: sumMetric("profile_views"),
    reachTotal: sumMetric("reach"),
    savedTotal: 0, // idem
    reelsInteractionRate: 0, // idem
  };
}

/**
 * Top N mídias por engajamento. Pega lista crua + chama /insights por mídia
 * só pras top N (limita custo de API). Os campos `views`/`saved` vêm desse
 * passo extra; pra IMAGE/CAROUSEL ficam zerados (não suportam essas métricas).
 */
export async function fetchInstagramTopMedia(
  igUserId: string,
  pageAccessToken: string,
  limit = 6,
): Promise<InstagramMedia[]> {
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_product_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
    "like_count",
    "comments_count",
  ].join(",");

  const listUrl =
    `${META_GRAPH}/${igUserId}/media?` +
    `fields=${fields}` +
    `&limit=${Math.min(50, limit * 3)}` + // pega um pouco mais pra ordenar por engajamento
    `&access_token=${encodeURIComponent(pageAccessToken)}`;

  const list = await igFetch<IgMediaListResp>(listUrl);
  const items = list.data ?? [];

  // Ordena por (likes+comments) desc — proxy de engajamento sem chamar /insights.
  items.sort((a, b) => {
    const aEng = (a.like_count ?? 0) + (a.comments_count ?? 0);
    const bEng = (b.like_count ?? 0) + (b.comments_count ?? 0);
    return bEng - aEng;
  });

  const top = items.slice(0, limit);

  // Pra cada top, busca insights pra pegar views/saved (apenas VIDEO/REEL).
  const result: InstagramMedia[] = [];
  for (const m of top) {
    const isVideoOrReel =
      m.media_type === "VIDEO" || m.media_product_type === "REELS";
    const mediaType: InstagramMedia["mediaType"] =
      m.media_product_type === "REELS"
        ? "REEL"
        : (m.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM") ?? "IMAGE";

    let views = 0;
    let saved = 0;
    if (isVideoOrReel) {
      try {
        const insightsRes = await igFetch<IgInsightsResp>(
          `${META_GRAPH}/${m.id}/insights?metric=plays,saved&access_token=${encodeURIComponent(pageAccessToken)}`,
        );
        for (const ins of insightsRes.data ?? []) {
          const val = ins.values?.[0]?.value ?? 0;
          if (ins.name === "plays") views = val;
          if (ins.name === "saved") saved = val;
        }
      } catch {
        // tolera falha por mídia — só não enriquece esse item.
      }
    }

    result.push({
      id: m.id,
      caption: m.caption ?? null,
      mediaType,
      mediaUrl: m.media_url ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      permalink: m.permalink ?? null,
      timestamp: m.timestamp,
      likeCount: m.like_count ?? 0,
      commentsCount: m.comments_count ?? 0,
      viewsCount: views,
      saved,
    });
  }

  return result;
}
