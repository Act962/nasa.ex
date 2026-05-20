import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  fetchAdsBreakdowns,
  fetchAdsTimeSeries,
  type BreakdownRow,
  type TimeSeriesRow,
} from "@/http/meta/ads-management";
import { z } from "zod";
import { getMetaAuth } from "./_helpers";

const DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
] as const;

const BREAKDOWN_ENUM = ["age", "gender", "publisher_platform", "region"] as const;

/**
 * Breakdown único da conta no período. Retorna agregação por valor do
 * segmento (idade/gênero/plataforma/região). Usado pelos widgets de
 * "Distribuições" e "Regiões com maior alcance" no relatório de Tráfego Meta.
 *
 * Mantém o contrato simples e tolerante: se a conta não estiver conectada
 * ou a Meta API falhar, retorna `{ connected: false/true, rows: [] }` sem
 * jogar erro — UI mostra estado vazio.
 */
export const getInsightsBreakdown = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      breakdown: z.enum(BREAKDOWN_ENUM),
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
      return {
        connected: false,
        rows: [] as BreakdownRow[],
        breakdown: input.breakdown,
      };
    }

    try {
      const rows = await fetchAdsBreakdowns(auth, {
        breakdown: input.breakdown,
        datePreset: input.datePreset,
        timeRange:
          input.startDate && input.endDate
            ? {
                since: input.startDate.slice(0, 10),
                until: input.endDate.slice(0, 10),
              }
            : undefined,
      });
      // Ordena por spend desc — pra UI mostrar a fatia mais relevante primeiro.
      rows.sort((a, b) => b.spend - a.spend);
      return { connected: true, rows, breakdown: input.breakdown };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar breakdown";
      return {
        connected: true,
        rows: [] as BreakdownRow[],
        breakdown: input.breakdown,
        error: msg,
      };
    }
  });

/**
 * Time series diário das métricas básicas da conta (spend/impressions/reach/clicks).
 * Usado pelo chart "Investido por dia" do relatório.
 */
export const getInsightsTimeSeries = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
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
      return { connected: false, rows: [] as TimeSeriesRow[] };
    }

    try {
      const rows = await fetchAdsTimeSeries(auth, {
        datePreset: input.datePreset,
        timeRange:
          input.startDate && input.endDate
            ? {
                since: input.startDate.slice(0, 10),
                until: input.endDate.slice(0, 10),
              }
            : undefined,
      });
      // Ordena cronologicamente — chart espera ASC por data.
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return { connected: true, rows };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar série";
      return { connected: true, rows: [] as TimeSeriesRow[], error: msg };
    }
  });
