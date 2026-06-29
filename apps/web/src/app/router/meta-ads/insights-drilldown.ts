import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { fetchAdsInsights } from "@/http/meta/ads-management";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getMetaAuth } from "./_helpers";
import { getMetaConversionTagId } from "./_conversion-tag";

const DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "maximum",
] as const;

/**
 * Drill-down de insights da Meta com:
 *  - `level` (campaign|adset|ad) — agregação remota da Meta API
 *  - `time_range` (custom) OU `date_preset` — exclusivos por spec, time_range vence
 *  - Override da coluna `Conv.` via tag de conversão configurada na org:
 *      conta leads únicos que tenham `LeadTag` com a tag configurada
 *      E sejam atribuídos à entidade (metaCampaignId / metaAdsetId / metaAdId).
 *  - Enrich de thumbnail no nível `ad` (de `MetaAd.creative.image_url`).
 */
export const getInsightsDrilldown = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      level: z.enum(["campaign", "adset", "ad"]).default("campaign"),
      datePreset: z.enum(DATE_PRESETS).default("last_30d"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      adAccountId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const auth = await getMetaAuth(context.org.id, {
      userId: context.user.id,
      adAccountIdOverride: input.adAccountId,
    });
    if (!auth) {
      return { connected: false, rows: [] as never[], conversionMode: "meta" as const };
    }

    const timeRange =
      input.startDate && input.endDate
        ? { since: input.startDate.slice(0, 10), until: input.endDate.slice(0, 10) }
        : undefined;

    try {
      const rows = await fetchAdsInsights(auth, {
        level: input.level,
        datePreset: input.datePreset,
        timeRange,
      });

      // ── Override Conv. via tag (se configurada) ──────────────────────────
      const conversionTagId = await getMetaConversionTagId(context.org.id);
      let conversionMode: "meta" | "tag" = "meta";

      // Coleta IDs por nível (mesmo loop pra montar pin e thumbnails)
      const adIds: string[] = [];
      for (const r of rows) {
        if (input.level === "ad" && r.adId) adIds.push(r.adId);
      }

      if (conversionTagId) {
        conversionMode = "tag";
        const dateFilter = timeRange
          ? {
              gte: new Date(`${timeRange.since}T00:00:00.000Z`),
              lte: new Date(`${timeRange.until}T23:59:59.999Z`),
            }
          : undefined;

        // Pega todos os leads da org com a tag de conversão no período. Em
        // memória depois agregamos por entityId — bem mais rápido do que N
        // queries (1 por linha do drilldown).
        const matchedLeads = await prisma.lead.findMany({
          where: {
            tracking: { organizationId: context.org.id },
            leadTags: { some: { tagId: conversionTagId } },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
            // Filtra leads com pelo menos uma atribuição Meta presente — quem
            // não tem nenhuma não conta como conversão atribuível.
            OR: [
              { metaCampaignId: { not: null } },
              { metaAdsetId: { not: null } },
              { metaAdId: { not: null } },
            ],
          },
          select: {
            id: true,
            metaCampaignId: true,
            metaAdsetId: true,
            metaAdId: true,
          },
        });

        const keyOf = (lead: (typeof matchedLeads)[number]): string | null => {
          if (input.level === "campaign") return lead.metaCampaignId;
          if (input.level === "adset") return lead.metaAdsetId;
          return lead.metaAdId;
        };

        const countByKey = new Map<string, number>();
        for (const lead of matchedLeads) {
          const k = keyOf(lead);
          if (!k) continue;
          countByKey.set(k, (countByKey.get(k) ?? 0) + 1);
        }

        // Reescreve a Conv. de cada linha com a contagem real. CPA e
        // conversionRate seguem a nova base.
        for (const r of rows) {
          const id =
            input.level === "campaign"
              ? r.campaignId
              : input.level === "adset"
                ? r.adsetId
                : r.adId;
          const conv = id ? countByKey.get(id) ?? 0 : 0;
          (r as { conversions: number }).conversions = conv;
          (r as { cpa: number }).cpa = conv > 0 ? r.spend / conv : 0;
          (r as { conversionRate: number }).conversionRate =
            r.clicks > 0 ? (conv / r.clicks) * 100 : 0;
          // roas precisa de conversionValue — fica null/0 se não tiver
        }
      }

      // ── Enrich com thumbnail (só level=ad) ───────────────────────────────
      let rowsOut: typeof rows = rows;
      if (input.level === "ad" && adIds.length > 0) {
        const metaAds = await prisma.metaAd.findMany({
          where: {
            organizationId: context.org.id,
            metaAdId: { in: adIds },
          },
          select: { metaAdId: true, previewUrl: true, creative: true },
        });
        const thumbByAd = new Map<string, string | null>();
        for (const m of metaAds) {
          if (!m.metaAdId) continue;
          const c = m.creative as
            | { thumbnail_url?: string; image_url?: string }
            | null;
          thumbByAd.set(
            m.metaAdId,
            c?.image_url ?? c?.thumbnail_url ?? m.previewUrl ?? null,
          );
        }
        rowsOut = rows.map((r) => ({
          ...r,
          thumbnailUrl: r.adId ? thumbByAd.get(r.adId) ?? null : null,
        })) as typeof rows;
      }

      return {
        connected: true,
        rows: rowsOut,
        conversionMode,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar insights";
      return {
        connected: true,
        rows: [] as never[],
        conversionMode: "meta" as const,
        error: msg,
      };
    }
  });
