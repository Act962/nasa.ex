import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const DATE_PRESETS = ["today", "yesterday", "last_7d", "last_30d", "last_90d", "this_month", "last_month"] as const;

// Meta Marketing API fields we request
const META_FIELDS = [
  "reach", "impressions", "frequency",
  "clicks", "ctr", "inline_post_engagement",
  "spend", "cpm", "cpc", "cpp",
  "conversions", "conversion_values",
  "video_play_actions", "video_thruplay_watched_actions", "video_avg_time_watched_actions",
  "actions", "cost_per_action_type", "cost_per_conversion",
  "website_ctr",
].join(",");

export const getMetaInsights = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    datePreset: z.enum(DATE_PRESETS).default("last_30d"),
    level: z.enum(["account", "campaign", "adset", "ad"]).default("account"),
  }))
  .handler(async ({ input, context }) => {
    // Get stored Meta integration credentials
    const integration = await prisma.platformIntegration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: "META",
        },
      },
    });

    if (!integration || !integration.isActive) {
      return { connected: false, data: null };
    }

    const config = integration.config as Record<string, string>;
    const { accessToken, adAccountId } = config;

    if (!accessToken || !adAccountId) {
      return { connected: false, data: null };
    }

    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const apiVersion = "v19.0";
    const url = `https://graph.facebook.com/${apiVersion}/${accountId}/insights?fields=${META_FIELDS}&date_preset=${input.datePreset}&level=${input.level}&access_token=${accessToken}`;

    try {
      const res = await fetch(url, { next: { revalidate: 300 } }); // cache 5 min
      const json = await res.json() as Record<string, unknown>;

      if (json.error) {
        const err = json.error as { message: string; code: number };
        return { connected: true, data: null, error: err.message };
      }

      const rawData = (json.data as Record<string, unknown>[])?.[0] ?? {};

      // Extract and normalize values
      const reach        = Number(rawData.reach ?? 0);
      const impressions  = Number(rawData.impressions ?? 0);
      const frequency    = Number(rawData.frequency ?? 0);
      const clicks       = Number(rawData.clicks ?? 0);
      const ctr          = Number(rawData.ctr ?? 0);
      const spend        = Number(rawData.spend ?? 0);
      const cpm          = Number(rawData.cpm ?? 0);
      const cpc          = Number(rawData.cpc ?? 0);
      const cpp          = Number(rawData.cpp ?? 0);
      const engagement   = Number(rawData.inline_post_engagement ?? 0);

      // Parse actions array for conversions and video
      const actions = (rawData.actions as { action_type: string; value: string }[]) ?? [];
      const getAction = (type: string) => {
        const a = actions.find((x) => x.action_type === type);
        return Number(a?.value ?? 0);
      };

      const conversions      = getAction("offsite_conversion.fb_pixel_purchase") ||
                               getAction("omni_purchase") ||
                               getAction("lead") ||
                               actions.filter(a => a.action_type.startsWith("offsite_conversion")).reduce((s, a) => s + Number(a.value), 0);
      const leads            = getAction("lead");
      const conversionValue  = Number((rawData.conversion_values as { value: string }[])?.[0]?.value ?? 0);
      const roas             = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0;
      const conversionRate   = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const cpl              = leads > 0 ? spend / leads : 0;
      const cpa              = conversions > 0 ? spend / conversions : 0;

      // Video metrics
      const videoPlays       = getAction("video_play");
      const thruPlays        = Number((rawData.video_thruplay_watched_actions as { value: string }[])?.[0]?.value ?? 0);
      const avgWatchTime     = Number((rawData.video_avg_time_watched_actions as { value: string }[])?.[0]?.value ?? 0);
      const videoRetention   = videoPlays > 0 ? (thruPlays / videoPlays) * 100 : 0;

      return {
        connected: true,
        error: null,
        data: {
          datePreset: input.datePreset,
          // Delivery
          reach, impressions, frequency,
          // Engagement
          clicks, ctr, engagement,
          // Costs
          spend, cpm, cpc, cpp, cpl, cpa,
          cpv: videoPlays > 0 ? spend / videoPlays : 0,
          // Conversion
          conversions, leads, conversionRate, roas, conversionValue,
          // Video
          videoPlays, thruPlays, avgWatchTime, videoRetention,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar com a API Meta";
      return { connected: true, data: null, error: msg };
    }
  });
