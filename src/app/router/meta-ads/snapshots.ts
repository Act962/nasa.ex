import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { fetchAdsInsights } from "@/http/meta/ads-management";
import { z } from "zod";
import { getMetaAuth } from "./_helpers";
import { MetaAdLevel } from "@/generated/prisma/enums";

// Persiste snapshot do dia para o nível solicitado.
// Útil pra Inngest cron e botão "Sync agora".
export const syncSnapshots = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      level: z.enum(["account", "campaign", "adset", "ad"]).default("campaign"),
      datePreset: z.string().default("yesterday"),
      adAccountId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const auth = await getMetaAuth(context.org.id, {
      userId: context.user.id,
      adAccountIdOverride: input.adAccountId,
    });
    if (!auth) return { synced: 0, connected: false };

    const rows = await fetchAdsInsights(auth, {
      level: input.level,
      datePreset: input.datePreset,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const levelEnum = input.level.toUpperCase() as MetaAdLevel;
    let synced = 0;

    for (const row of rows) {
      const entityId =
        input.level === "account"
          ? auth.adAccountId
          : input.level === "campaign"
            ? row.campaignId
            : input.level === "adset"
              ? row.adsetId
              : row.adId;
      if (!entityId) continue;

      const entityName =
        input.level === "campaign"
          ? row.campaignName
          : input.level === "adset"
            ? row.adsetName
            : input.level === "ad"
              ? row.adName
              : null;

      const data = {
        organizationId: context.org.id,
        level: levelEnum,
        entityId,
        entityName: entityName ?? null,
        date: today,
        datePreset: input.datePreset,
        reach: row.reach,
        impressions: row.impressions,
        frequency: row.frequency,
        clicks: row.clicks,
        ctr: row.ctr,
        engagement: row.engagement,
        spend: row.spend,
        cpm: row.cpm,
        cpc: row.cpc,
        cpp: row.cpp,
        cpl: row.cpl,
        cpa: row.cpa,
        cpv: row.cpv,
        conversions: row.conversions,
        leads: row.leads,
        conversionValue: row.conversionValue,
        conversionRate: row.conversionRate,
        roas: row.roas,
        roi: row.spend > 0 ? ((row.conversionValue - row.spend) / row.spend) * 100 : 0,
        videoPlays: row.videoPlays,
        videoP25: 0,
        videoP50: 0,
        videoP75: 0,
        videoP100: row.thruPlays,
        videoAvgWatchTime: row.avgWatchTime,
        raw: row as unknown as any,
        syncedAt: new Date(),
      };

      await prisma.metaAdsKpiSnapshot.upsert({
        where: {
          organizationId_level_entityId_date: {
            organizationId: context.org.id,
            level: levelEnum,
            entityId,
            date: today,
          },
        },
        create: data,
        update: data,
      });
      synced++;
    }

    return { synced, connected: true };
  });

export const listSnapshots = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      level: z.enum(["account", "campaign", "adset", "ad"]).default("campaign"),
      entityId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const snapshots = await prisma.metaAdsKpiSnapshot.findMany({
      where: {
        organizationId: context.org.id,
        level: input.level.toUpperCase() as MetaAdLevel,
        ...(input.entityId ? { entityId: input.entityId } : {}),
        ...(input.startDate && input.endDate
          ? { date: { gte: new Date(input.startDate), lte: new Date(input.endDate) } }
          : {}),
      },
      orderBy: { date: "desc" },
      take: 365,
    });
    return { snapshots };
  });
