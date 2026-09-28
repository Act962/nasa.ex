import "server-only";
import { META_GRAPH } from "@/http/meta/ads-management";
import { getMetaPageContext } from "@/app/router/meta-ads/_pages-helpers";
import {
  normalizeSocialHandle,
  type SocialNetwork,
  type TrafegoSocialProfile,
} from "@/features/trafego/lib/social-profile";
import { loadTrafegoSettings } from "./trafego-settings";

/**
 * Busca o perfil que o cliente informou usando a conta da AGÊNCIA:
 *  - Instagram: Business Discovery (`{ig-user-id}?fields=business_discovery.username(...)`),
 *    que só encontra contas Business/Creator — perfil pessoal volta "não encontrado".
 *  - Facebook: leitura pública da página pelo nome de usuário. Depende da
 *    permissão Page Public Content Access do app; sem ela, volta `skipped`.
 *
 * Cache de 10 min por handle para o cliente poder clicar "Verificar" à vontade.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

const globalForCache = globalThis as unknown as {
  __trafegoSocialCache?: Map<string, { value: TrafegoSocialProfile; expiresAt: number }>;
};
const cache =
  globalForCache.__trafegoSocialCache ?? (globalForCache.__trafegoSocialCache = new Map());

type IgDiscoveryResponse = {
  business_discovery?: {
    username?: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
    media_count?: number;
    biography?: string;
    website?: string;
  };
  error?: { message?: string; code?: number; error_subcode?: number };
};

type FbPageResponse = {
  id?: string;
  name?: string;
  username?: string;
  picture?: { data?: { url?: string } };
  fan_count?: number;
  followers_count?: number;
  verification_status?: string;
  link?: string;
  error?: { message?: string; code?: number };
};

function notFound(
  network: SocialNetwork,
  handle: string,
  reason: string,
): TrafegoSocialProfile {
  return {
    network,
    handle,
    found: false,
    name: null,
    username: null,
    pictureUrl: null,
    followers: null,
    mediaCount: null,
    biography: null,
    website: null,
    isVerified: null,
    checkedAt: new Date().toISOString(),
    reason,
  };
}

async function resolveAgencyPageContext() {
  const settings = await loadTrafegoSettings();
  if (!settings.agencyOrganizationId) return null;
  const context = await getMetaPageContext(settings.agencyOrganizationId);
  return context.page ? context : null;
}

export async function lookupSocialProfile(rawHandle: string): Promise<TrafegoSocialProfile | null> {
  const normalized = normalizeSocialHandle(rawHandle);
  if (!normalized) return null;
  const { network, handle } = normalized;

  const cacheKey = `${network}:${handle.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const context = await resolveAgencyPageContext();
  if (!context?.page) return notFound(network, handle, "lookup_unavailable");

  let profile: TrafegoSocialProfile;
  try {
    profile =
      network === "instagram"
        ? await lookupInstagram(handle, context.igAccount?.id ?? null, context.page.accessToken)
        : await lookupFacebook(handle, context.page.accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[trafego/social-lookup] ${network}/${handle}: ${message}`);
    profile = notFound(network, handle, "check_error");
  }

  cache.set(cacheKey, { value: profile, expiresAt: Date.now() + CACHE_TTL_MS });
  return profile;
}

async function lookupInstagram(
  handle: string,
  igUserId: string | null,
  accessToken: string,
): Promise<TrafegoSocialProfile> {
  if (!igUserId) return notFound("instagram", handle, "agency_without_instagram");

  const fields = "username,name,profile_picture_url,followers_count,media_count,biography,website";
  const url =
    `${META_GRAPH}/${igUserId}?fields=business_discovery.username(${encodeURIComponent(handle)}){${fields}}` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const json = (await response.json()) as IgDiscoveryResponse;

  if (json.error || !json.business_discovery) {
    // Código 110 / subcode 2207013 = usuário não existe ou não é Business/Creator.
    return notFound("instagram", handle, json.error?.code === 110 ? "not_business_or_not_found" : "not_found");
  }

  const found = json.business_discovery;
  return {
    network: "instagram",
    handle,
    found: true,
    name: found.name ?? null,
    username: found.username ?? handle,
    pictureUrl: found.profile_picture_url ?? null,
    followers: found.followers_count ?? null,
    mediaCount: found.media_count ?? null,
    biography: found.biography ?? null,
    website: found.website ?? null,
    isVerified: null,
    checkedAt: new Date().toISOString(),
    reason: null,
  };
}

async function lookupFacebook(handle: string, accessToken: string): Promise<TrafegoSocialProfile> {
  const fields = "id,name,username,picture.type(large){url},fan_count,followers_count,verification_status,link";
  const url =
    `${META_GRAPH}/${encodeURIComponent(handle)}?fields=${fields}` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const json = (await response.json()) as FbPageResponse;

  if (json.error || !json.id) {
    return notFound("facebook", handle, json.error?.code === 100 ? "not_found" : "lookup_unavailable");
  }

  return {
    network: "facebook",
    handle,
    found: true,
    name: json.name ?? null,
    username: json.username ?? handle,
    pictureUrl: json.picture?.data?.url ?? null,
    followers: json.followers_count ?? json.fan_count ?? null,
    mediaCount: null,
    biography: null,
    website: json.link ?? null,
    isVerified: json.verification_status ? json.verification_status !== "not_verified" : null,
    checkedAt: new Date().toISOString(),
    reason: null,
  };
}

/** A landing só mostra "Verificar conta" se a agência tem integração Meta com página. */
export async function isSocialLookupAvailable(): Promise<boolean> {
  return Boolean(await resolveAgencyPageContext());
}
