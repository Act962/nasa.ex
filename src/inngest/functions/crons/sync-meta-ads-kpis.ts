/**
 * Cron: sync-meta-ads-kpis
 * Roda diariamente às 3h — sincroniza snapshots Meta Ads (campanha/adset/ad)
 * para todas organizações com integração META ativa.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { fetchAdsInsights } from "@/http/meta/ads-management";
import { MetaAdLevel } from "@/generated/prisma/enums";

const LEVELS: Array<"campaign" | "adset" | "ad"> = ["campaign", "adset", "ad"];

export const syncMetaAdsKpis = inngest.createFunction(
  { id: "sync-meta-ads-kpis", retries: 1 },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const integrations = await step.run("load-meta-integrations", () =>
      prisma.platformIntegration.findMany({
        where: { platform: "META", isActive: true },
        select: { organizationId: true, config: true },
      }),
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSynced = 0;
    let orgsProcessed = 0;
    const errors: string[] = [];

    for (const integ of integrations) {
      const config = (integ.config ?? {}) as Record<string, string>;
      if (!config.accessToken || !config.adAccountId) continue;
      orgsProcessed++;

      for (const level of LEVELS) {
        try {
          const rows = await step.run(`fetch-${integ.organizationId}-${level}`, () =>
            fetchAdsInsights(
              { accessToken: config.accessToken, adAccountId: config.adAccountId },
              { level, datePreset: "yesterday" },
            ),
          );

          for (const row of rows) {
            const entityId =
              level === "campaign"
                ? row.campaignId
                : level === "adset"
                  ? row.adsetId
                  : row.adId;
            if (!entityId) continue;

            const entityName =
              level === "campaign"
                ? row.campaignName
                : level === "adset"
                  ? row.adsetName
                  : row.adName;

            const data = {
              organizationId: integ.organizationId,
              level: level.toUpperCase() as MetaAdLevel,
              entityId,
              entityName: entityName ?? null,
              date: today,
              datePreset: "yesterday",
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
                  organizationId: integ.organizationId,
                  level: level.toUpperCase() as MetaAdLevel,
                  entityId,
                  date: today,
                },
              },
              create: data,
              update: data,
            });
            totalSynced++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`org=${integ.organizationId} level=${level}: ${msg}`);
        }
      }
    }

    return { orgsProcessed, totalSynced, errors };
  },
);
