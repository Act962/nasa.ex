import prisma from "@/lib/prisma";
import { META_GRAPH, graphFetch } from "@/http/meta/ads-management";

/**
 * Resolve um Meta Ad ID (ex: vindo de `referral.source_id` no webhook CTWA)
 * para os IDs de adset/campaign correspondentes.
 *
 * Estratégia:
 * 1. Procura `MetaAd.metaAdId` localmente. Se existir, retorna IDs.
 * 2. Se não existir e tivermos um access token Meta da org, faz lookup na
 *    Graph API e UPSERT em `MetaAd`/`MetaAdSet`/`MetaAdCampaign`.
 * 3. Se não tiver token ou der erro, retorna apenas o `adId` informado
 *    — Lead ainda fica vinculado ao ad, e o cron `sync-meta-ads-structure`
 *    preencherá depois.
 */
export interface ResolvedMetaAd {
  adId: string;
  adsetId: string | null;
  campaignId: string | null;
  /** Quando true, conseguimos resolver via DB ou Graph; false = só conhecemos o adId. */
  resolved: boolean;
}

interface MetaIntegrationConfig {
  accessToken?: string;
  access_token?: string;
  page_access_token?: string;
}

export async function resolveMetaAd(
  metaAdId: string,
  organizationId: string,
): Promise<ResolvedMetaAd> {
  if (!metaAdId) {
    return { adId: metaAdId, adsetId: null, campaignId: null, resolved: false };
  }

  // 1. Cache local
  const local = await prisma.metaAd
    .findFirst({
      where: { metaAdId, organizationId },
      include: {
        adset: { select: { metaAdsetId: true } },
        campaign: { select: { metaCampaignId: true } },
      },
    })
    .catch(() => null);

  if (local) {
    return {
      adId: metaAdId,
      adsetId: local.adset?.metaAdsetId ?? null,
      campaignId: local.campaign?.metaCampaignId ?? null,
      resolved: true,
    };
  }

  // 2. Lazy fetch da Graph API
  const integration = await prisma.platformIntegration
    .findFirst({
      where: { organizationId, platform: "META", isActive: true },
    })
    .catch(() => null);

  const config = (integration?.config ?? {}) as MetaIntegrationConfig;
  const token =
    config.accessToken ?? config.access_token ?? config.page_access_token;

  if (!token) {
    return { adId: metaAdId, adsetId: null, campaignId: null, resolved: false };
  }

  try {
    const url = `${META_GRAPH}/${metaAdId}?fields=id,name,adset_id,campaign_id,creative{title,body,image_url}&access_token=${token}`;
    const json = await graphFetch<Record<string, unknown>>(url);

    const adsetId = (json.adset_id as string | undefined) ?? null;
    const campaignId = (json.campaign_id as string | undefined) ?? null;
    const adName = (json.name as string | undefined) ?? metaAdId;
    const creative = (json.creative as Record<string, unknown> | undefined) ?? null;

    // Upsert mínimo — nome real virá pelo cron de sync se faltar
    if (campaignId && adsetId) {
      const campaignRow = await prisma.metaAdCampaign.upsert({
        where: { metaCampaignId: campaignId },
        create: {
          organizationId,
          metaCampaignId: campaignId,
          adAccountId: "unknown",
          name: campaignId,
        },
        update: {},
      });

      const adsetRow = await prisma.metaAdSet.upsert({
        where: { metaAdsetId: adsetId },
        create: {
          organizationId,
          campaignId: campaignRow.id,
          metaAdsetId: adsetId,
          name: adsetId,
        },
        update: {},
      });

      await prisma.metaAd.upsert({
        where: { metaAdId },
        create: {
          organizationId,
          campaignId: campaignRow.id,
          adsetId: adsetRow.id,
          metaAdId,
          name: adName,
          creative: (creative ?? undefined) as object | undefined,
        },
        update: {
          name: adName,
          creative: (creative ?? undefined) as object | undefined,
        },
      });
    }

    return { adId: metaAdId, adsetId, campaignId, resolved: true };
  } catch (err) {
    console.warn("[resolveMetaAd] failed", err);
    return { adId: metaAdId, adsetId: null, campaignId: null, resolved: false };
  }
}
