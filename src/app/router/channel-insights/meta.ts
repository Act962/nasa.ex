import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { fetchAdsInsights } from "@/http/meta/ads-management";
import { getMetaAuth } from "@/app/router/meta-ads/_helpers";
import { z } from "zod";

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
 * Insights agregados da conta Meta (level=account por padrão).
 *
 * Delega o fetch pro helper compartilhado `fetchAdsInsights` (Graph v22.0 +
 * Bearer auth + time_range/date_preset mutuamente exclusivos) — antes essa
 * rota tinha o fetch hardcoded em v19.0 com `access_token` em querystring,
 * o que ficou inconsistente com o resto da feature e com a doc oficial.
 *
 * Mapeia OAuth errors (token expirado/revogado, code 190) pra mensagem
 * acionável em pt-BR.
 */

function friendlyMetaError(rawMsg: string): string {
  // Code 190 = "OAuthException" — token expirado, revogado ou malformado
  const lower = rawMsg.toLowerCase();
  if (
    lower.includes("oauth access token") ||
    lower.includes("cannot parse access token") ||
    lower.includes("session has expired") ||
    lower.includes("the user has not authorized") ||
    lower.includes("error validating access token")
  ) {
    return "Token Meta expirou ou foi revogado. Vá em Integrações e reconecte sua conta Meta.";
  }
  if (lower.includes("permission") || lower.includes("ads_read")) {
    return "Faltam permissões na conta Meta (ads_read / ads_management). Reconecte e aprove os escopos.";
  }
  if (lower.includes("rate limit") || lower.includes("user request limit reached")) {
    return "Limite de requisições da Meta atingido. Aguarde alguns minutos e tente novamente.";
  }
  return rawMsg;
}

export const getMetaInsights = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      datePreset: z.enum(DATE_PRESETS).default("last_30d"),
      level: z.enum(["account", "campaign", "adset", "ad"]).default("account"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const auth = await getMetaAuth(context.org.id, { userId: context.user.id });
    if (!auth) return { connected: false, data: null };

    try {
      const rows = await fetchAdsInsights(auth, {
        level: input.level,
        datePreset: input.datePreset,
        timeRange:
          input.startDate && input.endDate
            ? {
                since: input.startDate.slice(0, 10),
                until: input.endDate.slice(0, 10),
              }
            : undefined,
      });

      const row = rows[0];
      if (!row) {
        return {
          connected: true,
          error: null,
          data: {
            datePreset: input.datePreset,
            startDate: input.startDate ?? null,
            endDate: input.endDate ?? null,
            reach: 0, impressions: 0, frequency: 0,
            clicks: 0, ctr: 0, engagement: 0,
            spend: 0, cpm: 0, cpc: 0, cpp: 0, cpl: 0, cpa: 0, cpv: 0,
            conversions: 0, leads: 0, conversionRate: 0, roas: 0, conversionValue: 0,
            videoPlays: 0, thruPlays: 0, avgWatchTime: 0, videoRetention: 0,
          },
        };
      }

      const videoRetention =
        row.videoPlays > 0 ? (row.thruPlays / row.videoPlays) * 100 : 0;

      return {
        connected: true,
        error: null,
        data: {
          datePreset: input.datePreset,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          // Delivery
          reach: row.reach,
          impressions: row.impressions,
          frequency: row.frequency,
          // Engagement
          clicks: row.clicks,
          ctr: row.ctr,
          engagement: row.engagement,
          // Costs
          spend: row.spend,
          cpm: row.cpm,
          cpc: row.cpc,
          cpp: row.cpp,
          cpl: row.cpl,
          cpa: row.cpa,
          cpv: row.cpv,
          // Conversion
          conversions: row.conversions,
          leads: row.leads,
          conversionRate: row.conversionRate,
          roas: row.roas,
          conversionValue: row.conversionValue,
          // Video
          videoPlays: row.videoPlays,
          thruPlays: row.thruPlays,
          avgWatchTime: row.avgWatchTime,
          videoRetention,
        },
      };
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao conectar com a API Meta";
      return { connected: true, data: null, error: friendlyMetaError(raw) };
    }
  });
