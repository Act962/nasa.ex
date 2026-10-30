/**
 * Chamadas do construtor de campanha do trafeGO (spec 0124). Os payloads chegam
 * prontos de `build-meta-payloads.ts`; aqui só vão para a Graph v25, com o token
 * no cabeçalho e o `appsecret_proof`. Escrita nunca é repetida (graph-client).
 */

import { actId } from "./ads-management";
import { metaGraphPaginate, metaGraphRequest, type MetaRequestAuth } from "./graph-client";

export type MetaWritePayload = Record<string, string | number | boolean | object | null | undefined>;

/** Objetos e listas viram JSON, como a Graph espera nos campos `targeting`, `promoted_object` etc. */
export function encodeMetaPayload(payload: MetaWritePayload): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return body;
}

export async function createMetaObject(
  auth: MetaRequestAuth,
  adAccountId: string,
  edge: "campaigns" | "adsets" | "adcreatives" | "ads",
  payload: MetaWritePayload,
): Promise<{ id: string }> {
  return metaGraphRequest<{ id: string }>(`${actId(adAccountId)}/${edge}`, {
    auth,
    method: "POST",
    body: encodeMetaPayload(payload),
  });
}

export async function updateMetaObject(
  auth: MetaRequestAuth,
  objectId: string,
  payload: MetaWritePayload,
): Promise<{ success: boolean }> {
  return metaGraphRequest<{ success: boolean }>(objectId, { auth, method: "POST", body: encodeMetaPayload(payload) });
}

export interface MetaCityResult {
  key: string;
  name: string;
  region: string | null;
  countryCode: string;
}

/** Cidades para o público (`/search?type=adgeolocation`). */
export async function searchMetaCities(auth: MetaRequestAuth, query: string): Promise<MetaCityResult[]> {
  const response = await metaGraphRequest<{
    data?: { key: string; name: string; region?: string; country_code: string; type: string }[];
  }>("search", {
    auth,
    query: {
      type: "adgeolocation",
      location_types: JSON.stringify(["city"]),
      country_code: "BR",
      q: query,
      limit: 10,
    },
  });
  return (response.data ?? [])
    .filter((location) => location.type === "city")
    .map((location) => ({
      key: location.key,
      name: location.name,
      region: location.region ?? null,
      countryCode: location.country_code,
    }));
}

export interface MetaInstagramMedia {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaProductType: string | null;
  previewUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  isBoostEligible: boolean;
  ineligibleReason: string | null;
}

/** Posts do Instagram da conta, com a elegibilidade para virar anúncio (`boost_eligibility_info`). */
export async function listInstagramMedia(
  auth: MetaRequestAuth,
  instagramUserId: string,
  options?: { maxPages?: number },
): Promise<{ items: MetaInstagramMedia[]; truncated: boolean }> {
  const { items, truncated } = await metaGraphPaginate<{
    id: string;
    caption?: string;
    media_type: string;
    media_product_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp?: string;
    boost_eligibility_info?: { eligible_to_boost?: boolean; boost_ineligible_reason?: string };
  }>(`${instagramUserId}/media`, {
    auth,
    maxPages: options?.maxPages ?? 2,
    query: {
      fields:
        "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,boost_eligibility_info",
      limit: 25,
    },
  });
  return {
    items: items.map((media) => ({
      id: media.id,
      caption: media.caption ?? null,
      mediaType: media.media_type,
      mediaProductType: media.media_product_type ?? null,
      previewUrl: media.thumbnail_url ?? media.media_url ?? null,
      permalink: media.permalink ?? null,
      timestamp: media.timestamp ?? null,
      isBoostEligible: media.boost_eligibility_info?.eligible_to_boost !== false,
      ineligibleReason: media.boost_eligibility_info?.boost_ineligible_reason ?? null,
    })),
    truncated,
  };
}

/** Sobe uma imagem para a biblioteca da conta (`/act/adimages`, em base64) e devolve o hash. */
export async function uploadMetaAdImage(
  auth: MetaRequestAuth,
  adAccountId: string,
  image: { bytesBase64: string; fileName: string },
): Promise<{ hash: string }> {
  const body = new URLSearchParams({ bytes: image.bytesBase64, name: image.fileName });
  const response = await metaGraphRequest<{ images?: Record<string, { hash: string }> }>(
    `${actId(adAccountId)}/adimages`,
    { auth, method: "POST", body },
  );
  const uploaded = Object.values(response.images ?? {})[0];
  if (!uploaded?.hash) throw new Error("[MetaGraph] a Meta não devolveu o hash da imagem");
  return { hash: uploaded.hash };
}

export interface MetaCampaignTree {
  id: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  lifetimeBudgetCents: number | null;
  accountId: string | null;
  adsets: {
    id: string;
    name: string;
    status: string | null;
    effectiveStatus: string | null;
    endTime: string | null;
    pageId: string | null;
    targeting: Record<string, unknown> | null;
  }[];
  ads: {
    id: string;
    name: string;
    adsetId: string;
    status: string | null;
    effectiveStatus: string | null;
    previewUrl: string | null;
    previewLink: string | null;
  }[];
}

type RawCampaignTree = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  lifetime_budget?: string;
  account_id?: string;
  adsets?: {
    data?: {
      id: string;
      name: string;
      status?: string;
      effective_status?: string;
      end_time?: string;
      promoted_object?: { page_id?: string };
      targeting?: Record<string, unknown>;
    }[];
  };
  ads?: {
    data?: {
      id: string;
      name: string;
      adset_id: string;
      status?: string;
      effective_status?: string;
      creative?: { thumbnail_url?: string; image_url?: string };
      preview_shareable_link?: string;
    }[];
  };
};

const CAMPAIGN_TREE_FIELDS = [
  "id",
  "name",
  "status",
  "effective_status",
  "lifetime_budget",
  "account_id",
  "adsets.limit(25){id,name,status,effective_status,end_time,promoted_object,targeting}",
  "ads.limit(50){id,name,adset_id,status,effective_status,preview_shareable_link,creative{thumbnail_url,image_url}}",
].join(",");

function toTree(raw: RawCampaignTree): MetaCampaignTree {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status ?? null,
    effectiveStatus: raw.effective_status ?? null,
    lifetimeBudgetCents: raw.lifetime_budget ? Number(raw.lifetime_budget) : null,
    accountId: raw.account_id ?? null,
    adsets: (raw.adsets?.data ?? []).map((adset) => ({
      id: adset.id,
      name: adset.name,
      status: adset.status ?? null,
      effectiveStatus: adset.effective_status ?? null,
      endTime: adset.end_time ?? null,
      pageId: adset.promoted_object?.page_id ?? null,
      targeting: adset.targeting ?? null,
    })),
    ads: (raw.ads?.data ?? []).map((ad) => ({
      id: ad.id,
      name: ad.name,
      adsetId: ad.adset_id,
      status: ad.status ?? null,
      effectiveStatus: ad.effective_status ?? null,
      previewUrl: ad.creative?.thumbnail_url ?? ad.creative?.image_url ?? null,
      previewLink: ad.preview_shareable_link ?? null,
    })),
  };
}

export async function getMetaCampaignTree(auth: MetaRequestAuth, campaignId: string): Promise<MetaCampaignTree> {
  return toTree(await metaGraphRequest<RawCampaignTree>(campaignId, { auth, query: { fields: CAMPAIGN_TREE_FIELDS } }));
}

/** Campanhas da conta cujo nome contém o texto (código do pedido ou chave do rascunho), sem as arquivadas. */
export async function findMetaCampaignTreesByName(
  auth: MetaRequestAuth,
  adAccountId: string,
  nameContains: string,
): Promise<MetaCampaignTree[]> {
  const { items } = await metaGraphPaginate<RawCampaignTree>(`${actId(adAccountId)}/campaigns`, {
    auth,
    maxPages: 2,
    query: {
      fields: CAMPAIGN_TREE_FIELDS,
      limit: 25,
      filtering: JSON.stringify([
        { field: "name", operator: "CONTAIN", value: nameContains },
        { field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES"] },
      ]),
    },
  });
  return items.map(toTree);
}

export interface MetaAdSetPerformance {
  adsetId: string;
  spendCents: number;
  conversations: number;
  targeting: Record<string, unknown> | null;
}

/** Conjuntos da conta com gasto e conversas no período (180 dias na sugestão de público, RF-4). */
export async function listAdSetPerformanceForSuggestion(
  auth: MetaRequestAuth,
  adAccountId: string,
  period: { since: string; until: string },
): Promise<MetaAdSetPerformance[]> {
  const { items } = await metaGraphPaginate<{
    id: string;
    targeting?: Record<string, unknown>;
    insights?: { data?: { spend?: string; actions?: { action_type: string; value: string }[] }[] };
  }>(`${actId(adAccountId)}/adsets`, {
    auth,
    maxPages: 2,
    query: {
      fields: `id,targeting,insights.time_range(${JSON.stringify(period)}){spend,actions}`,
      limit: 50,
    },
  });
  return items.map((adset) => {
    const insight = adset.insights?.data?.[0];
    const conversations = Number(
      insight?.actions?.find((action) => action.action_type === "onsite_conversion.messaging_conversation_started_7d")
        ?.value ?? 0,
    );
    return {
      adsetId: adset.id,
      spendCents: Math.round(Number(insight?.spend ?? 0) * 100),
      conversations: Number.isFinite(conversations) ? conversations : 0,
      targeting: adset.targeting ?? null,
    };
  });
}

/** Legenda e dono de um post, relidos no servidor antes de anunciar (a entrada do navegador não vale). */
export async function getInstagramMedia(
  auth: MetaRequestAuth,
  mediaId: string,
): Promise<{ id: string; caption: string | null; ownerId: string | null }> {
  const media = await metaGraphRequest<{ id: string; caption?: string; owner?: { id?: string } }>(mediaId, {
    auth,
    query: { fields: "id,caption,owner" },
  });
  return { id: media.id, caption: media.caption ?? null, ownerId: media.owner?.id ?? null };
}
