import "server-only";
import prisma from "@/lib/prisma";
import { fetchAdsInsights, type InsightRow } from "@/http/meta/ads-management";

/**
 * Leitura ao vivo dos KPIs, para quando o snapshot ainda não existe.
 *
 * O cron de KPIs roda uma vez por dia às 3h e grava os dados de ONTEM. Quem
 * acabou de entrar no ar veria "sem dados ainda" por até 24h — que é
 * exatamente quando o cliente mais olha o painel. Aqui buscamos direto na
 * Marketing API.
 *
 * Cache de 15 minutos por pedido: o painel faz polling e a API da Meta tem
 * limite de chamadas. **Nunca grava snapshot** — o cron é o dono daquela
 * tabela, e gravar aqui criaria linha com data errada (o cron carimba a data
 * de hoje para o dado de ontem).
 */
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface LiveCampaignKpis {
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  conversions: number;
  /** Em reais, como a Meta devolve. */
  spend: number;
  fetchedAt: Date;
}

const globalForLiveCache = globalThis as unknown as {
  __trafegoLiveKpiCache?: Map<string, { value: LiveCampaignKpis | null; expiresAt: number }>;
};
const cache =
  globalForLiveCache.__trafegoLiveKpiCache ??
  (globalForLiveCache.__trafegoLiveKpiCache = new Map());

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sumRows(rows: InsightRow[]): Omit<LiveCampaignKpis, "fetchedAt"> {
  return rows.reduce(
    (total, row) => ({
      impressions: total.impressions + row.impressions,
      reach: total.reach + row.reach,
      clicks: total.clicks + row.clicks,
      leads: total.leads + row.leads,
      conversions: total.conversions + row.conversions,
      spend: total.spend + row.spend,
    }),
    { impressions: 0, reach: 0, clicks: 0, leads: 0, conversions: 0, spend: 0 },
  );
}

export async function getLiveCampaignKpis(params: {
  orderId: string;
  metricsOrganizationId: string;
  metaCampaignExternalId: string;
  since: Date;
  until: Date;
}): Promise<LiveCampaignKpis | null> {
  const cached = cache.get(params.orderId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const integration = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: params.metricsOrganizationId,
        platform: "META",
      },
    },
    select: { isActive: true, config: true },
  });

  const config = (integration?.config ?? {}) as Record<string, unknown>;
  const accessToken = config.accessToken as string | undefined;
  const adAccountId = (config.adAccountId ?? config.adAccounts) as string | undefined;

  if (!integration?.isActive || !accessToken || typeof adAccountId !== "string") {
    cache.set(params.orderId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  try {
    const rows = await fetchAdsInsights(
      { accessToken, adAccountId },
      {
        level: "campaign",
        timeRange: { since: toIsoDate(params.since), until: toIsoDate(params.until) },
      },
    );
    const mine = rows.filter((row) => row.campaignId === params.metaCampaignExternalId);
    const value: LiveCampaignKpis | null =
      mine.length > 0 ? { ...sumRows(mine), fetchedAt: new Date() } : null;

    cache.set(params.orderId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    console.warn(`[trafego/live-kpis] leitura ao vivo falhou (${params.orderId}):`, error);
    // Cacheia a falha pelo mesmo período: sem isso, token expirado viraria
    // uma chamada à Meta a cada polling do painel.
    cache.set(params.orderId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }
}
