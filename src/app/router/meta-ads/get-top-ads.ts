import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

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
    }),
  )
  .handler(async ({ input, context }) => {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    const snaps = await prisma.metaAdsKpiSnapshot.findMany({
      where: {
        organizationId: context.org.id,
        level: "AD",
        date: { gte: start, lte: end },
      },
    });

    if (snaps.length === 0) return { ads: [] as TopAd[] };

    const num = (v: unknown): number =>
      typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;

    type Bucket = {
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
    const byId = new Map<string, Bucket>();

    for (const s of snaps) {
      const ex = byId.get(s.entityId);
      if (!ex) {
        byId.set(s.entityId, {
          entityId: s.entityId,
          entityName: s.entityName,
          spend: num(s.spend),
          reach: num(s.reach),
          impressions: s.impressions ?? 0,
          clicks: s.clicks ?? 0,
          conversions: s.conversions ?? 0,
          leads: s.leads ?? 0,
          engagement: s.engagement ?? 0,
        });
      } else {
        ex.spend += num(s.spend);
        ex.reach = Math.max(ex.reach, num(s.reach));
        ex.impressions += s.impressions ?? 0;
        ex.clicks += s.clicks ?? 0;
        ex.conversions += s.conversions ?? 0;
        ex.leads += s.leads ?? 0;
        ex.engagement += s.engagement ?? 0;
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
