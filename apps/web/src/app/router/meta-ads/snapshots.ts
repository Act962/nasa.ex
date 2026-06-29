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

/**
 * Lista snapshots de KPIs Meta filtrados. Quando `adAccountId` é passado
 * (ou resolvido via user override), filtra:
 *   - ACCOUNT: por `entityId === adAccountId` (entityId é a própria conta)
 *   - CAMPAIGN/ADSET/AD: faz join via `MetaAdCampaign`/`MetaAdSet`/`MetaAd`
 *     filtrando por `adAccountId`, e devolve só snapshots dessas entidades.
 *
 * Sem esse filtro, contagens/médias misturavam dados de TODAS as ad accounts
 * conectadas — quebrando o "Número de campanhas/anúncios" no relatório.
 */
export const listSnapshots = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      level: z.enum(["account", "campaign", "adset", "ad"]).default("campaign"),
      entityId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      adAccountId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const auth = await getMetaAuth(orgId, {
      userId: context.user.id,
      adAccountIdOverride: input.adAccountId,
    });
    const levelEnum = input.level.toUpperCase() as MetaAdLevel;

    // Pré-resolve entityIds permitidos quando filtramos por ad account.
    let allowedEntityIds: string[] | null = null;
    if (auth) {
      if (input.level === "account") {
        allowedEntityIds = [auth.adAccountId];
      } else if (input.level === "campaign") {
        const rows = await prisma.metaAdCampaign.findMany({
          where: { organizationId: orgId, adAccountId: auth.adAccountId },
          select: { metaCampaignId: true },
        });
        allowedEntityIds = rows.map((r) => r.metaCampaignId).filter(Boolean) as string[];
      } else if (input.level === "adset") {
        // MetaAdSet não tem adAccountId direto — vai via campaign.
        const rows = await prisma.metaAdSet.findMany({
          where: {
            organizationId: orgId,
            campaign: { adAccountId: auth.adAccountId },
          },
          select: { metaAdsetId: true },
        });
        allowedEntityIds = rows.map((r) => r.metaAdsetId).filter(Boolean) as string[];
      } else if (input.level === "ad") {
        const rows = await prisma.metaAd.findMany({
          where: {
            organizationId: orgId,
            campaign: { adAccountId: auth.adAccountId },
          },
          select: { metaAdId: true },
        });
        allowedEntityIds = rows.map((r) => r.metaAdId).filter(Boolean) as string[];
      }
    }

    // Se filtramos por conta e ela não tem entidades cadastradas no banco
    // (MetaAdCampaign/AdSet/Ad ainda não sincronizadas pelo cron), pula o
    // SELECT no snapshot — sabemos que retornaria vazio — e cai direto pra
    // tentativa de fallback live abaixo.
    const skipDbQuery =
      allowedEntityIds !== null && allowedEntityIds.length === 0;

    const snapshots = skipDbQuery
      ? []
      : await prisma.metaAdsKpiSnapshot.findMany({
          where: {
            organizationId: orgId,
            level: levelEnum,
            ...(input.entityId ? { entityId: input.entityId } : {}),
            ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
            ...(input.startDate && input.endDate
              ? {
                  date: {
                    gte: new Date(input.startDate),
                    lte: new Date(input.endDate),
                  },
                }
              : {}),
          },
          orderBy: { date: "desc" },
          take: 365,
        });

    // ── Fallback live (read-only) ─────────────────────────────────────────
    // Cron ainda não populou o banco pra essa conta? Busca direto da Meta API
    // pra UI não ficar com "0 campanhas". Não grava nada — só responde a esse
    // request. Quando o cron rodar, volta a usar o cache do banco.
    if (
      snapshots.length === 0 &&
      auth &&
      input.startDate &&
      input.endDate &&
      input.level !== "account" // account já é coberto por getMetaTrafficOverview
    ) {
      try {
        const live = await fetchAdsInsights(auth, {
          level: input.level,
          timeRange: {
            since: input.startDate.slice(0, 10),
            until: input.endDate.slice(0, 10),
          },
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Constrói rows no mesmo formato do MetaAdsKpiSnapshot pro client não
        // precisar distinguir. `id` e `organizationId` são sintéticos.
        const liveSnaps = live
          .map((r) => {
            const entityId =
              input.level === "campaign"
                ? r.campaignId
                : input.level === "adset"
                  ? r.adsetId
                  : r.adId;
            if (!entityId) return null;
            const entityName =
              input.level === "campaign"
                ? r.campaignName
                : input.level === "adset"
                  ? r.adsetName
                  : input.level === "ad"
                    ? r.adName
                    : null;
            return {
              id: `live-${entityId}`,
              organizationId: orgId,
              level: levelEnum,
              entityId,
              entityName: entityName ?? null,
              date: today,
              datePreset: null,
              reach: r.reach,
              impressions: r.impressions,
              frequency: r.frequency,
              clicks: r.clicks,
              ctr: r.ctr,
              engagement: r.engagement,
              spend: r.spend,
              cpm: r.cpm,
              cpc: r.cpc,
              cpp: r.cpp,
              cpl: r.cpl,
              cpa: r.cpa,
              cpv: r.cpv,
              conversions: r.conversions,
              leads: r.leads,
              conversionValue: r.conversionValue,
              conversionRate: r.conversionRate,
              roas: r.roas,
              roi: r.spend > 0 ? ((r.conversionValue - r.spend) / r.spend) * 100 : 0,
              videoPlays: r.videoPlays,
              videoP25: 0,
              videoP50: 0,
              videoP75: 0,
              videoP100: r.thruPlays,
              videoAvgWatchTime: r.avgWatchTime,
              raw: null,
              syncedAt: today,
              createdAt: today,
            };
          })
          .filter(Boolean);
        return { snapshots: liveSnaps, source: "live" as const };
      } catch {
        // Falha de API → mantém banco vazio (estado anterior)
        return { snapshots, source: "snapshot" as const };
      }
    }

    return { snapshots, source: "snapshot" as const };
  });
