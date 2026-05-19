import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { fetchAdsInsights } from "@/http/meta/ads-management";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getMetaAuth } from "./_helpers";

/**
 * Top-N anúncios do período, com preview/thumbnail para o relatório de
 * tráfego.
 *
 * Agrega snapshots `level=AD` por entityId, ordena por spend decrescente,
 * e faz JOIN com `MetaAd` (via `metaAdId === entityId`) pra pegar `previewUrl`,
 * `creative` (json), e o nome canônico.
 *
 * Retorna até `limit` anúncios (default 8). Se o anúncio não tiver `MetaAd`
 * cadastrado (ex: cron rodou mas sincronização de campanhas não), o item
 * volta sem preview, mas com nome do snapshot.
 */
export const getTopAds = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
      limit: z.number().int().min(1).max(50).default(8),
      campaignId: z.string().optional(),
      adAccountId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    // Filtro de ad account: pega só metaAdIds da conta ativa do user.
    const auth = await getMetaAuth(context.org.id, {
      userId: context.user.id,
      adAccountIdOverride: input.adAccountId,
    });
    let adAccountFilterIds: string[] | null = null;
    if (auth) {
      const adsInAccount = await prisma.metaAd.findMany({
        where: {
          organizationId: context.org.id,
          campaign: { adAccountId: auth.adAccountId },
        },
        select: { metaAdId: true },
      });
      adAccountFilterIds = adsInAccount
        .map((a) => a.metaAdId)
        .filter(Boolean) as string[];
      // Conta sem MetaAd cadastrado (cron não rodou) → não retornamos vazio
      // aqui; deixamos o fallback live abaixo tentar puxar direto da API.
    }
    const noLocalAds =
      adAccountFilterIds !== null && adAccountFilterIds.length === 0;

    type SnapRow = {
      entityId: string;
      entityName: string | null;
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      conversions: number;
      leads: number;
      engagement: number;
    };

    let snapRows: SnapRow[] = noLocalAds
      ? []
      : (
          await prisma.metaAdsKpiSnapshot.findMany({
            where: {
              organizationId: context.org.id,
              level: "AD",
              date: { gte: start, lte: end },
              ...(adAccountFilterIds
                ? { entityId: { in: adAccountFilterIds } }
                : {}),
            },
          })
        ).map((s) => ({
          entityId: s.entityId,
          entityName: s.entityName,
          spend:
            typeof s.spend === "string"
              ? parseFloat(s.spend)
              : Number(s.spend ?? 0),
          reach:
            typeof s.reach === "string"
              ? parseFloat(s.reach)
              : Number(s.reach ?? 0),
          impressions: s.impressions ?? 0,
          clicks: s.clicks ?? 0,
          conversions: s.conversions ?? 0,
          leads: s.leads ?? 0,
          engagement: s.engagement ?? 0,
        }));

    // Fallback live (read-only): banco vazio + Meta conectada → busca da API.
    if (snapRows.length === 0 && auth) {
      try {
        const live = await fetchAdsInsights(auth, {
          level: "ad",
          timeRange: {
            since: input.startDate.slice(0, 10),
            until: input.endDate.slice(0, 10),
          },
        });
        snapRows = live
          .filter((r) => r.adId)
          .map((r) => ({
            entityId: r.adId!,
            entityName: r.adName ?? null,
            spend: r.spend,
            reach: r.reach,
            impressions: r.impressions,
            clicks: r.clicks,
            conversions: r.conversions,
            leads: r.leads,
            engagement: r.engagement,
          }));
      } catch {
        // Falha de API → mantém vazio
      }
    }

    if (snapRows.length === 0) return { ads: [] as TopAd[] };

    type Bucket = SnapRow;
    const byId = new Map<string, Bucket>();

    for (const s of snapRows) {
      const ex = byId.get(s.entityId);
      if (!ex) {
        byId.set(s.entityId, { ...s });
      } else {
        ex.spend += s.spend;
        ex.reach = Math.max(ex.reach, s.reach);
        ex.impressions += s.impressions;
        ex.clicks += s.clicks;
        ex.conversions += s.conversions;
        ex.leads += s.leads;
        ex.engagement += s.engagement;
      }
    }

    let buckets = Array.from(byId.values()).sort((a, b) => b.spend - a.spend);

    // Filtro opcional por campanha (busca os AD ids que pertencem à campanha)
    if (input.campaignId) {
      const ads = await prisma.metaAd.findMany({
        where: {
          organizationId: context.org.id,
          campaign: { metaCampaignId: input.campaignId },
        },
        select: { metaAdId: true },
      });
      const allowed = new Set(ads.map((a) => a.metaAdId).filter(Boolean) as string[]);
      buckets = buckets.filter((b) => allowed.has(b.entityId));
    }

    buckets = buckets.slice(0, input.limit);

    const metaAds = await prisma.metaAd.findMany({
      where: {
        organizationId: context.org.id,
        metaAdId: { in: buckets.map((b) => b.entityId) },
      },
      select: {
        metaAdId: true,
        name: true,
        previewUrl: true,
        creative: true,
      },
    });
    const adInfo = new Map(metaAds.map((m) => [m.metaAdId!, m]));

    type TopAd = {
      metaAdId: string;
      name: string;
      previewUrl: string | null;
      thumbnailUrl: string | null;
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      conversions: number;
      leads: number;
      engagement: number;
      ctr: number;
      cpc: number;
      cpm: number;
      cpa: number;
      frequency: number;
    };

    const ads: TopAd[] = buckets.map((b) => {
      const info = adInfo.get(b.entityId);
      const creative = (info?.creative ?? null) as
        | { thumbnail_url?: string; image_url?: string }
        | null;
      const thumbnailUrl =
        creative?.thumbnail_url ??
        creative?.image_url ??
        info?.previewUrl ??
        null;
      return {
        metaAdId: b.entityId,
        name: info?.name ?? b.entityName ?? b.entityId,
        previewUrl: info?.previewUrl ?? null,
        thumbnailUrl,
        spend: b.spend,
        reach: b.reach,
        impressions: b.impressions,
        clicks: b.clicks,
        conversions: b.conversions,
        leads: b.leads,
        engagement: b.engagement,
        ctr: b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0,
        cpc: b.clicks > 0 ? b.spend / b.clicks : 0,
        cpm: b.impressions > 0 ? (b.spend / b.impressions) * 1000 : 0,
        cpa: b.conversions > 0 ? b.spend / b.conversions : 0,
        frequency: b.reach > 0 ? b.impressions / b.reach : 0,
      };
    });

    return { ads };
  });
