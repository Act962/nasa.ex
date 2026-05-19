import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getMetaAuth } from "@/app/router/meta-ads/_helpers";
import { getMetaConversionTagId } from "@/app/router/meta-ads/_conversion-tag";
import { fetchAdsInsights } from "@/http/meta/ads-management";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Agrega snapshots ACCOUNT-level de `MetaAdsKpiSnapshot` para o período
 * solicitado. Retorna a mesma forma de `channelInsights.meta.data` para o
 * Relatório de Tráfego Meta funcionar mesmo sem OAuth ao vivo
 * (útil em dev com seed e em produção quando o cron já populou snapshots).
 *
 * Espelha a config do canal Meta (Insights > Integrações > Canais):
 *  - Filtra por `adAccountId` ativa do usuário (resolvida via `getMetaAuth`).
 *    Sem isso, agregava TODAS as ad accounts da org — números inflados.
 *  - Aplica a tag de conversão configurada (se houver): override de
 *    `conversions`/`cpa`/`conversionRate` baseado em leads do CRM.
 *
 * Fallback automático: quando não há snapshots no período (cron ainda não
 * rodou pra essa conta) mas o token Meta é válido, busca **ao vivo** na Meta
 * Marketing API (mesmo path do `channelInsights.meta`). A operação é
 * **read-only** — não grava nada no banco, só serve a UI naquele request.
 * Quando o cron popular, volta a usar o cache do banco automaticamente.
 */
export const getMetaTrafficOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
      adAccountId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    // Resolve a conta ativa do usuário (mesma lógica do drilldown e do canal).
    const auth = await getMetaAuth(context.org.id, {
      userId: context.user.id,
      adAccountIdOverride: input.adAccountId,
    });

    const snaps = await prisma.metaAdsKpiSnapshot.findMany({
      where: {
        organizationId: context.org.id,
        level: "ACCOUNT",
        date: { gte: start, lte: end },
        // Pra ACCOUNT-level, entityId === adAccountId (ver `syncSnapshots`).
        ...(auth ? { entityId: auth.adAccountId } : {}),
      },
      orderBy: { date: "asc" },
    });

    // ── Fallback live (read-only) ─────────────────────────────────────────
    // Sem snapshots no período. Se a Meta está conectada, busca direto da API
    // pra a UI não ficar vazia até o cron popular o cache.
    if (snaps.length === 0) {
      if (!auth) {
        return { connected: false, source: "snapshot" as const, data: null };
      }
      try {
        const liveRows = await fetchAdsInsights(auth, {
          level: "account",
          timeRange: {
            since: input.startDate.slice(0, 10),
            until: input.endDate.slice(0, 10),
          },
        });
        const live = liveRows[0];
        if (!live) {
          return { connected: false, source: "snapshot" as const, data: null };
        }

        // Aplica tag de conversão (mesma lógica do branch de snapshot abaixo).
        const conversionTagId = await getMetaConversionTagId(context.org.id);
        let liveConversions = live.conversions;
        let conversionMode: "live" | "tag" = "live";
        if (conversionTagId) {
          liveConversions = await prisma.lead.count({
            where: {
              tracking: { organizationId: context.org.id },
              leadTags: { some: { tagId: conversionTagId } },
              createdAt: { gte: start, lte: end },
              OR: [
                { metaCampaignId: { not: null } },
                { metaAdsetId: { not: null } },
                { metaAdId: { not: null } },
              ],
            },
          });
          conversionMode = "tag";
        }

        const cpaLive =
          liveConversions > 0 ? live.spend / liveConversions : 0;
        const conversionRateLive =
          live.clicks > 0 ? (liveConversions / live.clicks) * 100 : 0;
        const videoRetentionLive =
          live.videoPlays > 0 ? (live.thruPlays / live.videoPlays) * 100 : 0;

        return {
          connected: true,
          source: "live" as const,
          conversionMode,
          adAccountId: auth.adAccountId,
          data: {
            datePreset: null,
            startDate: input.startDate,
            endDate: input.endDate,
            reach: live.reach,
            impressions: live.impressions,
            frequency: live.frequency,
            clicks: live.clicks,
            ctr: live.ctr,
            engagement: live.engagement,
            spend: live.spend,
            cpm: live.cpm,
            cpc: live.cpc,
            cpp: live.cpp,
            cpl: live.cpl,
            cpa: cpaLive,
            cpv: live.cpv,
            conversions: liveConversions,
            leads: live.leads,
            conversionRate: conversionRateLive,
            roas: live.roas,
            conversionValue: live.conversionValue,
            videoPlays: live.videoPlays,
            thruPlays: live.thruPlays,
            avgWatchTime: live.avgWatchTime,
            videoRetention: videoRetentionLive,
          },
        };
      } catch {
        // Token inválido / rate-limit / API down → degrade pra estado "sem dados"
        return { connected: false, source: "snapshot" as const, data: null };
      }
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

    // ── Override de conversão via tag (se configurada na org) ─────────────
    // Conta leads únicos da org que tenham a tag E sejam atribuíveis a alguma
    // campanha Meta (metaCampaignId/metaAdsetId/metaAdId), criados no período.
    // Mesma fonte de verdade do drilldown — garante consistência entre as telas.
    const conversionTagId = await getMetaConversionTagId(context.org.id);
    let conversionMode: "snapshot" | "tag" = "snapshot";
    if (conversionTagId) {
      const matchedLeads = await prisma.lead.count({
        where: {
          tracking: { organizationId: context.org.id },
          leadTags: { some: { tagId: conversionTagId } },
          createdAt: { gte: start, lte: end },
          OR: [
            { metaCampaignId: { not: null } },
            { metaAdsetId: { not: null } },
            { metaAdId: { not: null } },
          ],
        },
      });
      conversions = matchedLeads;
      conversionMode = "tag";
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
      conversionMode,
      adAccountId: auth?.adAccountId ?? null,
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
