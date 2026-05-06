import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Agrega snapshots ACCOUNT-level de `MetaAdsKpiSnapshot` para o período
 * solicitado. Retorna a mesma forma de `channelInsights.meta.data` para o
 * Relatório de Tráfego Meta funcionar mesmo sem OAuth ao vivo
 * (útil em dev com seed e em produção quando o cron já populou snapshots).
 */
export const getMetaTrafficOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    const snaps = await prisma.metaAdsKpiSnapshot.findMany({
      where: {
        organizationId: context.org.id,
        level: "ACCOUNT",
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    if (snaps.length === 0) {
      return { connected: false, source: "snapshot" as const, data: null };
    }

    const num = (v: unknown): number =>
      typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;

    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let engagement = 0;
    let conversions = 0;
    let leads = 0;
    let conversionValue = 0;
    let videoPlays = 0;
    let videoP100 = 0; // proxy de ThruPlay
    let videoAvgWatchAcc = 0;
    let reachMax = 0;

    for (const s of snaps) {
      spend += num(s.spend);
      impressions += s.impressions ?? 0;
      clicks += s.clicks ?? 0;
      engagement += s.engagement ?? 0;
      conversions += s.conversions ?? 0;
      leads += s.leads ?? 0;
      conversionValue += num(s.conversionValue);
      videoPlays += s.videoPlays ?? 0;
      videoP100 += s.videoP100 ?? 0;
      videoAvgWatchAcc += num(s.videoAvgWatchTime);
      reachMax = Math.max(reachMax, num(s.reach));
    }

    // Reach não soma — usamos o max diário como aproximação
    const reach = reachMax;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpp = reach > 0 ? (spend / reach) * 1000 : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const cpv = videoPlays > 0 ? spend / videoPlays : 0;
    const frequency = reach > 0 ? impressions / reach : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const roas = spend > 0 ? conversionValue / spend : 0;
    const avgWatchTime = snaps.length > 0 ? videoAvgWatchAcc / snaps.length : 0;
    const videoRetention = videoPlays > 0 ? (videoP100 / videoPlays) * 100 : 0;

    return {
      connected: true,
      source: "snapshot" as const,
      data: {
        datePreset: null,
        startDate: input.startDate,
        endDate: input.endDate,
        reach,
        impressions,
        frequency,
        clicks,
        ctr,
        engagement,
        spend,
        cpm,
        cpc,
        cpp,
        cpl,
        cpa,
        cpv,
        conversions,
        leads,
        conversionRate,
        roas,
        conversionValue,
        videoPlays,
        thruPlays: videoP100,
        avgWatchTime,
        videoRetention,
      },
    };
  });
