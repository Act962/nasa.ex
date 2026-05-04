import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { fetchAdsInsights } from "@/http/meta/ads-management";
import { z } from "zod";
import { getMetaAuth } from "./_helpers";

const DATE_PRESETS = ["today", "yesterday", "last_7d", "last_30d", "last_90d", "this_month", "last_month"] as const;

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
    if (!auth) return { connected: false, rows: [] as never[] };

    try {
      const rows = await fetchAdsInsights(auth, {
        level: input.level,
        datePreset: input.datePreset,
        timeRange:
          input.startDate && input.endDate
            ? { since: input.startDate.slice(0, 10), until: input.endDate.slice(0, 10) }
            : undefined,
      });
      return { connected: true, rows };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar insights";
      return { connected: true, rows: [] as never[], error: msg };
    }
  });
