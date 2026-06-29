/**
 * Helpers para captura de Click-to-Meta-Ad referral em webhooks.
 *
 * O payload de `referral` chega com formato ligeiramente diferente em cada canal
 * (WhatsApp Cloud API via uazapi, Instagram DM, Facebook Messenger), mas a
 * informação relevante é a mesma: ad_id da Meta + texto do criativo +
 * source_url + ctwa_clid (clique). Este módulo:
 *
 *  1. extractMetaReferral — normaliza N caminhos possíveis no payload
 *  2. ctwaToLeadData — converte pra campos do `Lead.create`
 *  3. trackCtwaReferralEvent — log padrão do evento `ctwa_referral`
 */
import { resolveMetaAd, type ResolvedMetaAd } from "./resolve-meta-ad";
import { trackLeadEvent } from "./track";

export interface MetaReferralPayload {
  metaAdId: string;
  ctwaClid?: string;
  metaSourceUrl?: string;
  metaHeadline?: string;
  metaBody?: string;
}

type Channel = "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";

/**
 * Tenta extrair o objeto `referral` em qualquer um dos paths conhecidos.
 * Pra WhatsApp via uazapi: `message.referral`, `message.content.referral`.
 * Pra Insta/Facebook Messenger: `event.referral`, `event.ig_referral`,
 * `message.referral`.
 *
 * Retorna `null` quando o payload não tem source_id (ad_id) — único campo
 * obrigatório pra vincular o lead a um ad Meta.
 */
export function extractMetaReferral(
  ...sources: any[]
): MetaReferralPayload | null {
  let referral: any = null;
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const cand =
      src.referral ??
      src.ig_referral ??
      src.content?.referral ??
      null;
    if (cand && typeof cand === "object") {
      referral = cand;
      break;
    }
  }
  if (!referral) return null;

  const adId =
    referral.source_id ??
    referral.sourceId ??
    referral.ad_id ??
    referral.adId;
  if (!adId) return null;

  return {
    metaAdId: String(adId),
    ctwaClid: referral.ctwa_clid ?? referral.ctwaClid ?? undefined,
    metaSourceUrl:
      referral.source_url ?? referral.sourceUrl ?? referral.ref ?? undefined,
    metaHeadline: referral.headline ?? referral.title ?? undefined,
    metaBody: referral.body ?? referral.text ?? undefined,
  };
}

/**
 * Mapeia o referral pros campos do Lead, com adset/campaign já resolvidos.
 * Spread direto em `prisma.lead.create({ data: { ...ctwaToLeadData(...) } })`.
 */
export function ctwaToLeadData(
  ref: MetaReferralPayload,
  resolved: ResolvedMetaAd | null,
) {
  return {
    ctwaClid: ref.ctwaClid,
    metaAdId: ref.metaAdId,
    metaAdsetId: resolved?.adsetId ?? undefined,
    metaCampaignId: resolved?.campaignId ?? undefined,
    metaSourceUrl: ref.metaSourceUrl,
    metaHeadline: ref.metaHeadline,
    metaBody: ref.metaBody,
  };
}

/**
 * Helper combinado: resolve adset/campaign ids + log do evento.
 * Não cria/atualiza lead — caller faz isso, recebendo `ctwaToLeadData(...)`.
 */
export async function captureMetaReferralForNewLead(
  leadId: string,
  ref: MetaReferralPayload,
  resolved: ResolvedMetaAd | null,
  channel: Channel,
) {
  await trackLeadEvent({
    leadId,
    kind: "ctwa_referral",
    metadata: {
      metaAdId: ref.metaAdId,
      metaAdsetId: resolved?.adsetId,
      metaCampaignId: resolved?.campaignId,
      ctwaClid: ref.ctwaClid,
      sourceUrl: ref.metaSourceUrl,
      headline: ref.metaHeadline,
      channel,
    },
  });
}

/**
 * Atalho usado em todos os 3 webhooks: extrai → resolve → retorna `{ ref, resolved }`.
 * Caller decide se passa pro Lead.create.
 */
export async function resolveReferralForOrg(
  organizationId: string,
  ...payloadSources: any[]
): Promise<{
  ref: MetaReferralPayload;
  resolved: ResolvedMetaAd | null;
} | null> {
  const ref = extractMetaReferral(...payloadSources);
  if (!ref) return null;
  const resolved = await resolveMetaAd(ref.metaAdId, organizationId);
  return { ref, resolved };
}

export type { Channel };
