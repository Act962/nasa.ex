import {
  fetchAdsInsights,
  listMetaCampaigns,
  updateMetaCampaign,
  type MetaAuth,
} from "@/http/meta/ads-management";
import { spawnMetaMcpServer, type McpServerHandle } from "./server-spawn";

/**
 * Camada de abstração entre tools NASA e Meta Ads (MCP ou API direta).
 *
 * Modos:
 *  - **MCP mode** (`META_MCP_SERVER_CMD` setado): comunica via stdio com o
 *    servidor MCP oficial da Meta (subprocesso) usando `@modelcontextprotocol/sdk`.
 *  - **Direct mode** (default em dev/teste): chama Marketing API direto via
 *    `src/http/meta/ads-management.ts`.
 *
 * Os métodos públicos têm a mesma forma em ambos os modos — quem chama
 * (tools do AI workspace) não muda.
 */

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  objective?: string;
  /** Em reais (não centavos) */
  dailyBudgetReais?: number;
};

export type InsightsResult = {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  cpa: number;
  conversions: number;
  leads: number;
  roas: number;
};

export type MetaMcpClient = {
  listCampaigns(opts?: {
    status?: "ACTIVE" | "PAUSED" | "ALL";
  }): Promise<CampaignSummary[]>;
  getInsights(opts: {
    level: "account" | "campaign" | "adset" | "ad";
    entityId?: string;
    datePreset?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<InsightsResult>;
  pauseCampaign(opts: { campaignId: string }): Promise<{ ok: true }>;
  resumeCampaign(opts: { campaignId: string }): Promise<{ ok: true }>;
  close(): Promise<void>;
};

/**
 * Cria um client Meta MCP pra uma org/sessão.
 * Lazy: spawn do MCP server só acontece se modo MCP estiver ativo.
 */
export async function createMetaMcpClient(auth: MetaAuth): Promise<MetaMcpClient> {
  const useMcp = !!process.env.META_MCP_SERVER_CMD;
  if (!useMcp) return createDirectClient(auth);

  let handle: McpServerHandle | null = null;
  const ensureHandle = async () => {
    if (!handle) handle = await spawnMetaMcpServer(auth);
    return handle;
  };

  return {
    async listCampaigns(opts) {
      const h = await ensureHandle();
      const result = await h.callTool("list_campaigns", {
        ad_account_id: auth.adAccountId,
        status: opts?.status ?? "ALL",
      });
      return result as CampaignSummary[];
    },
    async getInsights(opts) {
      const h = await ensureHandle();
      const result = await h.callTool("get_insights", {
        ad_account_id: auth.adAccountId,
        ...opts,
      });
      return result as InsightsResult;
    },
    async pauseCampaign(opts) {
      const h = await ensureHandle();
      await h.callTool("pause_campaign", { campaign_id: opts.campaignId });
      return { ok: true };
    },
    async resumeCampaign(opts) {
      const h = await ensureHandle();
      await h.callTool("resume_campaign", { campaign_id: opts.campaignId });
      return { ok: true };
    },
    async close() {
      if (handle) {
        await handle.close();
        handle = null;
      }
    },
  };
}

// ─── Direct Marketing API client (fallback / default) ──────────────────────

function createDirectClient(auth: MetaAuth): MetaMcpClient {
  return {
    async listCampaigns(opts) {
      // Tenta Graph API; se falhar (token inválido, fake, etc.), fallback
      // pros snapshots/cache de `MetaAdCampaign` no banco — útil pra ambiente
      // de demo/seed sem OAuth real.
      try {
        const camps = await listMetaCampaigns(auth);
        const filtered =
          opts?.status && opts.status !== "ALL"
            ? camps.filter((c) => c.status === opts.status)
            : camps;
        return filtered.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status ?? "UNKNOWN",
          effectiveStatus: c.effective_status,
          objective: c.objective,
          dailyBudgetReais:
            c.daily_budget != null ? Number(c.daily_budget) / 100 : undefined,
        }));
      } catch {
        // Fallback — lê do cache local (MetaAdCampaign por adAccountId)
        const { default: prisma } = await import("@/lib/prisma");
        const cached = await prisma.metaAdCampaign.findMany({
          where: {
            adAccountId: auth.adAccountId,
            ...(opts?.status && opts.status !== "ALL"
              ? { status: opts.status }
              : {}),
          },
          orderBy: { createdAt: "desc" },
        });
        return cached.map((c) => ({
          id: c.metaCampaignId ?? c.id,
          name: c.name,
          status: c.status,
          effectiveStatus: c.effectiveStatus ?? undefined,
          objective: c.objective ?? undefined,
          dailyBudgetReais: c.dailyBudget != null ? Number(c.dailyBudget) : undefined,
        }));
      }
    },
    async getInsights(opts) {
      const timeRange =
        opts.startDate && opts.endDate
          ? {
              since: opts.startDate.slice(0, 10),
              until: opts.endDate.slice(0, 10),
            }
          : undefined;
      let rows;
      try {
        rows = await fetchAdsInsights(auth, {
          level: opts.level,
          datePreset: opts.datePreset,
          timeRange,
        });
      } catch {
        // Fallback — lê snapshots persistidos (seed/cron) quando Graph API falha
        const { default: prisma } = await import("@/lib/prisma");
        // Resolve orgId via adAccountId
        const camp = await prisma.metaAdCampaign.findFirst({
          where: { adAccountId: auth.adAccountId },
          select: { organizationId: true },
        });
        if (!camp) throw new Error("Não há cache local pra essa conta");
        const dateFilter =
          opts.startDate && opts.endDate
            ? {
                date: {
                  gte: new Date(opts.startDate),
                  lte: new Date(opts.endDate),
                },
              }
            : opts.datePreset === "last_7d"
              ? {
                  date: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  },
                }
              : opts.datePreset === "last_30d" || !opts.datePreset
                ? {
                    date: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                  }
                : opts.datePreset === "last_90d"
                  ? {
                      date: {
                        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                      },
                    }
                  : {};
        const levelEnum = opts.level.toUpperCase() as
          | "ACCOUNT"
          | "CAMPAIGN"
          | "ADSET"
          | "AD";
        const snaps = await prisma.metaAdsKpiSnapshot.findMany({
          where: {
            organizationId: camp.organizationId,
            level: levelEnum,
            ...(opts.entityId ? { entityId: opts.entityId } : {}),
            ...dateFilter,
          },
        });
        const num = (v: unknown): number =>
          typeof v === "string"
            ? parseFloat(v)
            : typeof v === "number"
              ? v
              : 0;
        rows = snaps.map((s) => ({
          campaignId: levelEnum === "CAMPAIGN" ? s.entityId : undefined,
          adsetId: levelEnum === "ADSET" ? s.entityId : undefined,
          adId: levelEnum === "AD" ? s.entityId : undefined,
          spend: num(s.spend),
          reach: num(s.reach),
          impressions: s.impressions ?? 0,
          frequency: num(s.frequency),
          clicks: s.clicks ?? 0,
          ctr: num(s.ctr),
          engagement: s.engagement ?? 0,
          cpm: num(s.cpm),
          cpc: num(s.cpc),
          cpp: num(s.cpp),
          cpl: num(s.cpl),
          cpa: num(s.cpa),
          cpv: num(s.cpv),
          conversions: s.conversions ?? 0,
          leads: s.leads ?? 0,
          conversionValue: num(s.conversionValue),
          conversionRate: num(s.conversionRate),
          roas: num(s.roas),
          videoPlays: s.videoPlays ?? 0,
          thruPlays: s.videoP100 ?? 0,
          avgWatchTime: num(s.videoAvgWatchTime),
        }));
      }
      // Filtra row específica se entityId foi passado
      const target =
        opts.entityId != null
          ? rows.filter((r) => {
              const id =
                opts.level === "campaign"
                  ? r.campaignId
                  : opts.level === "adset"
                    ? r.adsetId
                    : opts.level === "ad"
                      ? r.adId
                      : undefined;
              return id === opts.entityId;
            })
          : rows;
      const agg = target.reduce(
        (a, r) => {
          a.spend += r.spend ?? 0;
          a.reach = Math.max(a.reach, r.reach ?? 0);
          a.impressions += r.impressions ?? 0;
          a.clicks += r.clicks ?? 0;
          a.conversions += r.conversions ?? 0;
          a.leads += r.leads ?? 0;
          a.conversionValue += r.conversionValue ?? 0;
          return a;
        },
        {
          spend: 0,
          reach: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          leads: 0,
          conversionValue: 0,
        },
      );
      return {
        spend: agg.spend,
        reach: agg.reach,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
        cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
        cpa: agg.conversions > 0 ? agg.spend / agg.conversions : 0,
        conversions: agg.conversions,
        leads: agg.leads,
        roas: agg.spend > 0 ? agg.conversionValue / agg.spend : 0,
      };
    },
    async pauseCampaign(opts) {
      try {
        await updateMetaCampaign(auth, opts.campaignId, { status: "PAUSED" });
      } catch {
        // Fallback — atualiza só o cache local (útil em demo/seed sem token real)
        const { default: prisma } = await import("@/lib/prisma");
        await prisma.metaAdCampaign.updateMany({
          where: { metaCampaignId: opts.campaignId, adAccountId: auth.adAccountId },
          data: { status: "PAUSED" },
        });
      }
      return { ok: true };
    },
    async resumeCampaign(opts) {
      try {
        await updateMetaCampaign(auth, opts.campaignId, { status: "ACTIVE" });
      } catch {
        const { default: prisma } = await import("@/lib/prisma");
        await prisma.metaAdCampaign.updateMany({
          where: { metaCampaignId: opts.campaignId, adAccountId: auth.adAccountId },
          data: { status: "ACTIVE" },
        });
      }
      return { ok: true };
    },
    async close() {
      // Direct mode não tem subprocesso pra fechar
    },
  };
}
