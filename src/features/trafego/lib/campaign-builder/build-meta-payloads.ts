/**
 * Payloads da campanha de mensagens no WhatsApp (spec 0124, seção 7). Fonte única
 * dos campos que vão para a Meta: se a API mudar, muda aqui. Puro: o script de QA testa direto.
 *
 * Tudo explícito, nada implícito (regra da agência): status PAUSADO, `bid_strategy`,
 * placements em lista e `advantage_audience` declarado.
 */

export const CTWA_OBJECTIVE = "OUTCOME_ENGAGEMENT";
export const CTWA_BID_STRATEGY = "LOWEST_COST_WITHOUT_CAP";
export const CTWA_CALL_TO_ACTION = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } } as const;
/** Link padrão do clique para WhatsApp com imagem: a Meta troca pelo número da página. */
export const CTWA_IMAGE_LINK = "https://api.whatsapp.com/send";

export const MIN_AGE = 18;
export const MAX_AGE = 65;
/** Raio de cidade aceito pela Meta: 10 a 50 milhas. */
export const MIN_RADIUS_KM = 17;
export const MAX_RADIUS_KM = 80;

/** Sem Audience Network, sem Messenger e sem `explore` (removido na v26). */
export const CTWA_PUBLISHER_PLATFORMS = ["facebook", "instagram"] as const;
export const CTWA_FACEBOOK_POSITIONS = ["feed", "story", "facebook_reels", "marketplace", "video_feeds"] as const;
export const CTWA_INSTAGRAM_POSITIONS = ["stream", "story", "reels", "profile_feed"] as const;

export type AudienceGender = "all" | "male" | "female";

export interface AudienceDraft {
  cityKey: string;
  cityName: string;
  radiusKm: number;
  ageMin: number;
  ageMax: number;
  gender: AudienceGender;
}

const DRAFT_KEY_PATTERN = /^[a-z0-9]{6,10}$/;
const DRAFT_KEY_IN_NAME = /#([a-z0-9]{6,10})\s*$/;

export function isValidDraftKey(draftKey: string): boolean {
  return DRAFT_KEY_PATTERN.test(draftKey);
}

/** Chave curta do rascunho, gerada no navegador: trava contra clique duplo (RF-8, D-4). */
export function generateDraftKey(randomValues: Uint8Array): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomValues.slice(0, 8), (value) => alphabet[value % alphabet.length]).join("");
}

export function buildCampaignName(params: { orderCode: string; businessName: string | null; draftKey: string }): string {
  const business = (params.businessName ?? "").replace(/[#\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return [params.orderCode, business || null, "Mensagens"].filter(Boolean).join(" — ") + ` #${params.draftKey}`;
}

export function extractDraftKey(campaignName: string): string | null {
  return campaignName.match(DRAFT_KEY_IN_NAME)?.[1] ?? null;
}

export function clampAudience(audience: AudienceDraft): AudienceDraft {
  const ageMin = Math.min(MAX_AGE, Math.max(MIN_AGE, Math.round(audience.ageMin)));
  return {
    ...audience,
    radiusKm: Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(audience.radiusKm))),
    ageMin,
    ageMax: Math.min(MAX_AGE, Math.max(ageMin, Math.round(audience.ageMax))),
  };
}

export function buildTargeting(audience: AudienceDraft): Record<string, unknown> {
  const safeAudience = clampAudience(audience);
  return {
    geo_locations: {
      cities: [{ key: safeAudience.cityKey, radius: safeAudience.radiusKm, distance_unit: "kilometer" }],
      location_types: ["home", "recent"],
    },
    age_min: safeAudience.ageMin,
    age_max: safeAudience.ageMax,
    ...(safeAudience.gender === "male" ? { genders: [1] } : safeAudience.gender === "female" ? { genders: [2] } : {}),
    publisher_platforms: [...CTWA_PUBLISHER_PLATFORMS],
    facebook_positions: [...CTWA_FACEBOOK_POSITIONS],
    instagram_positions: [...CTWA_INSTAGRAM_POSITIONS],
    device_platforms: ["mobile", "desktop"],
    // 0 = a Meta respeita idade e gênero como estão (D-5).
    targeting_automation: { advantage_audience: 0 },
  };
}

/** Lê de volta o público de um conjunto existente (sugestão e edição). `null` quando não é por cidade. */
export function readAudienceFromTargeting(targeting: Record<string, unknown> | null): Omit<AudienceDraft, "cityName"> & {
  cityName: string | null;
} | null {
  if (!targeting) return null;
  const geo = targeting.geo_locations as { cities?: { key?: string; name?: string; radius?: number; distance_unit?: string }[] } | undefined;
  const city = geo?.cities?.[0];
  if (!city?.key) return null;
  const radiusKm = city.distance_unit === "mile" ? Math.round((city.radius ?? 10) * 1.609) : (city.radius ?? MIN_RADIUS_KM);
  const genders = Array.isArray(targeting.genders) ? (targeting.genders as number[]) : [];
  return {
    cityKey: city.key,
    cityName: city.name ?? null,
    radiusKm,
    ageMin: typeof targeting.age_min === "number" ? targeting.age_min : MIN_AGE,
    ageMax: typeof targeting.age_max === "number" ? targeting.age_max : MAX_AGE,
    gender: genders.length === 1 ? (genders[0] === 1 ? "male" : "female") : "all",
  };
}

export function buildCampaignPayload(params: { name: string; lifetimeBudgetCents: number }) {
  return {
    name: params.name,
    objective: CTWA_OBJECTIVE,
    status: "PAUSED",
    buying_type: "AUCTION",
    special_ad_categories: [] as string[],
    lifetime_budget: Math.round(params.lifetimeBudgetCents),
    bid_strategy: CTWA_BID_STRATEGY,
  };
}

export function buildAdSetPayload(params: {
  name: string;
  campaignId: string;
  pageId: string;
  audience: AudienceDraft;
  endTimeIso: string;
  startTimeIso?: string;
}) {
  return {
    name: params.name,
    campaign_id: params.campaignId,
    status: "PAUSED",
    destination_type: "WHATSAPP",
    optimization_goal: "CONVERSATIONS",
    billing_event: "IMPRESSIONS",
    promoted_object: { page_id: params.pageId },
    targeting: buildTargeting(params.audience),
    end_time: params.endTimeIso,
    ...(params.startTimeIso ? { start_time: params.startTimeIso } : {}),
  };
}

export type AdSource =
  | { kind: "instagram_post"; mediaId: string }
  | { kind: "image"; imageHash: string; message: string; headline: string | null };

/** Criativo do anúncio. Post do Instagram é o caminho principal (D-2). */
export function buildCreativePayload(params: {
  name: string;
  pageId: string;
  instagramUserId: string | null;
  source: AdSource;
}) {
  if (params.source.kind === "instagram_post") {
    return {
      name: params.name,
      object_id: params.pageId,
      instagram_user_id: params.instagramUserId,
      source_instagram_media_id: params.source.mediaId,
      call_to_action: CTWA_CALL_TO_ACTION,
    };
  }
  return {
    name: params.name,
    object_story_spec: {
      page_id: params.pageId,
      ...(params.instagramUserId ? { instagram_user_id: params.instagramUserId } : {}),
      link_data: {
        link: CTWA_IMAGE_LINK,
        image_hash: params.source.imageHash,
        message: params.source.message,
        ...(params.source.headline ? { name: params.source.headline } : {}),
        call_to_action: CTWA_CALL_TO_ACTION,
      },
    },
  };
}

export function buildAdPayload(params: { name: string; adsetId: string; creativeId: string }) {
  return {
    name: params.name,
    adset_id: params.adsetId,
    creative: { creative_id: params.creativeId },
    status: "PAUSED",
  };
}
