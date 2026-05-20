/**
 * Cron: sync-meta-ads-structure
 * Roda diariamente às 3h15 — sincroniza ESTRUTURA Meta Ads (campaigns, adsets, ads)
 * para todas organizações com integração META ativa.
 *
 * Alimenta `MetaAdCampaign`/`MetaAdSet`/`MetaAd` com nome/objetivo/criativo,
 * permitindo:
 *  - Mostrar nome legível quando o webhook CTWA traz só o `ad_id`
 *  - Dashboard de origem agrupar leads por nome de campanha
 *  - resolveMetaAd usar cache local em vez de Graph API
 *
 * Irmão de `sync-meta-ads-kpis.ts` (que sincroniza apenas KPIs/insights diários).
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  listMetaCampaigns,
  listMetaAdSets,
  listMetaAds,
} from "@/http/meta/ads-management";

const SYNC_FUNCTION_ID = "sync-meta-ads-structure";

export const syncMetaAdsStructure = inngest.createFunction(
  { id: SYNC_FUNCTION_ID, retries: 1 },
  { cron: "15 3 * * *" },
  async ({ step }) => {
    const integrations = await step.run("load-meta-integrations", () =>
      prisma.platformIntegration.findMany({
        where: { platform: "META", isActive: true },
        select: { id: true, organizationId: true, config: true },
      }),
    );

    let orgsProcessed = 0;
    let campaignsUpserted = 0;
    let adsetsUpserted = 0;
    let adsUpserted = 0;
    const errors: string[] = [];

    for (const integ of integrations) {
      const config = (integ.config ?? {}) as Record<string, string>;
      if (!config.accessToken || !config.adAccountId) continue;
      orgsProcessed++;

      const auth = {
        accessToken: config.accessToken,
        adAccountId: config.adAccountId,
      };

      // ── 1. Campaigns ─────────────────────────────────────────────
      try {
        const campaigns = await step.run(
          `campaigns-${integ.organizationId}`,
          () => listMetaCampaigns(auth),
        );
        for (const c of campaigns) {
          await prisma.metaAdCampaign
            .upsert({
              where: { metaCampaignId: c.id },
              create: {
                organizationId: integ.organizationId,
                metaCampaignId: c.id,
                adAccountId: config.adAccountId,
                name: c.name,
                objective: c.objective,
                effectiveStatus: c.effective_status,
                lastSyncedAt: new Date(),
                raw: c as object,
              },
              update: {
                name: c.name,
                objective: c.objective,
                effectiveStatus: c.effective_status,
                lastSyncedAt: new Date(),
                raw: c as object,
              },
            })
            .then(() => {
              campaignsUpserted++;
            })
            .catch((err) =>
              errors.push(`campaign ${c.id}: ${(err as Error).message}`),
            );
        }
      } catch (err) {
        errors.push(`campaigns ${integ.organizationId}: ${(err as Error).message}`);
        continue; // sem campaigns, não há como fazer adsets/ads
      }

      // ── 2. AdSets ────────────────────────────────────────────────
      try {
        const adsets = await step.run(
          `adsets-${integ.organizationId}`,
          () => listMetaAdSets(auth),
        );

        // Carrega todos os campaigns relevantes em uma query (evita N+1)
        const adsetCampaignIds = Array.from(new Set(adsets.map((a) => a.campaign_id)));
        const campaignRows = adsetCampaignIds.length
          ? await prisma.metaAdCampaign.findMany({
              where: { metaCampaignId: { in: adsetCampaignIds } },
              select: { id: true, metaCampaignId: true },
            })
          : [];
        const campaignByMeta = new Map(
          campaignRows.map((c) => [c.metaCampaignId!, c.id]),
        );

        for (const a of adsets) {
          const campaignLocalId = campaignByMeta.get(a.campaign_id);
          if (!campaignLocalId) continue;

          await prisma.metaAdSet
            .upsert({
              where: { metaAdsetId: a.id },
              create: {
                organizationId: integ.organizationId,
                campaignId: campaignLocalId,
                metaAdsetId: a.id,
                name: a.name,
                effectiveStatus: a.effective_status,
                optimizationGoal: a.optimization_goal,
                billingEvent: a.billing_event,
                lastSyncedAt: new Date(),
                raw: a as object,
              },
              update: {
                name: a.name,
                effectiveStatus: a.effective_status,
                optimizationGoal: a.optimization_goal,
                billingEvent: a.billing_event,
                lastSyncedAt: new Date(),
                raw: a as object,
              },
            })
            .then(() => {
              adsetsUpserted++;
            })
            .catch((err) =>
              errors.push(`adset ${a.id}: ${(err as Error).message}`),
            );
        }
      } catch (err) {
        errors.push(`adsets ${integ.organizationId}: ${(err as Error).message}`);
      }

      // ── 3. Ads ──────────────────────────────────────────────────
      try {
        const ads = await step.run(
          `ads-${integ.organizationId}`,
          () => listMetaAds(auth),
        );

        // Mesma estratégia: 2 queries (campaigns + adsets) em vez de 2N
        const adCampaignIds = Array.from(new Set(ads.map((a) => a.campaign_id)));
        const adAdsetIds = Array.from(new Set(ads.map((a) => a.adset_id)));
        const [campaignRows, adsetRows] = await Promise.all([
          adCampaignIds.length
            ? prisma.metaAdCampaign.findMany({
                where: { metaCampaignId: { in: adCampaignIds } },
                select: { id: true, metaCampaignId: true },
              })
            : Promise.resolve([]),
          adAdsetIds.length
            ? prisma.metaAdSet.findMany({
                where: { metaAdsetId: { in: adAdsetIds } },
                select: { id: true, metaAdsetId: true },
              })
            : Promise.resolve([]),
        ]);
        const campaignByMeta = new Map(
          campaignRows.map((c) => [c.metaCampaignId!, c.id]),
        );
        const adsetByMeta = new Map(
          adsetRows.map((s) => [s.metaAdsetId!, s.id]),
        );

        for (const ad of ads) {
          const campaignLocalId = campaignByMeta.get(ad.campaign_id);
          const adsetLocalId = adsetByMeta.get(ad.adset_id);
          if (!campaignLocalId || !adsetLocalId) continue;

          // Creative agora vem com field expansion (`creative{image_url,thumbnail_url,...}`).
          // Persistimos o objeto inteiro em `creative` (JSON) e priorizamos
          // image_url > thumbnail_url > preview_shareable_link como `previewUrl`
          // pra usar como thumbnail nos relatórios.
          const creative = ad.creative ?? null;
          const previewUrl =
            creative?.image_url ??
            creative?.thumbnail_url ??
            ad.preview_shareable_link ??
            null;

          await prisma.metaAd
            .upsert({
              where: { metaAdId: ad.id },
              create: {
                organizationId: integ.organizationId,
                campaignId: campaignLocalId,
                adsetId: adsetLocalId,
                metaAdId: ad.id,
                name: ad.name,
                effectiveStatus: ad.effective_status,
                creativeId: creative?.id,
                creative: creative
                  ? (creative as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
                previewUrl,
                lastSyncedAt: new Date(),
                raw: ad as object,
              },
              update: {
                name: ad.name,
                effectiveStatus: ad.effective_status,
                creativeId: creative?.id,
                creative: creative
                  ? (creative as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
                previewUrl,
                lastSyncedAt: new Date(),
                raw: ad as object,
              },
            })
            .then(() => {
              adsUpserted++;
            })
            .catch((err) =>
              errors.push(`ad ${ad.id}: ${(err as Error).message}`),
            );
        }
      } catch (err) {
        errors.push(`ads ${integ.organizationId}: ${(err as Error).message}`);
      }

      await prisma.platformIntegration
        .update({
          where: { id: integ.id },
          data: { lastSyncAt: new Date() },
        })
        .catch(() => {});
    }

    return {
      orgsProcessed,
      campaignsUpserted,
      adsetsUpserted,
      adsUpserted,
      errors: errors.slice(0, 20),
    };
  },
);
