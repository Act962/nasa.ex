import { tool } from "ai";
import { z } from "zod";
import { runMetaMcpRead } from "@/features/astro-meta-ads/server/meta-mcp-tools";

/**
 * GATEWAY TOOL — chamada antes de qualquer ação focada em campanha. Lê as campanhas
 * da conta da org pelo MCP oficial da Meta (spec 0125) e devolve a lista que o
 * frontend mostra como seletor.
 */

type RawCampaign = {
  id?: string;
  name?: string;
  effective_status?: string;
  status?: string;
  objective?: string;
  daily_budget?: { value?: string } | string;
};

function parseEntities(result: unknown): RawCampaign[] {
  const raw = (result as { ad_entities?: unknown } | null)?.ad_entities;
  if (Array.isArray(raw)) return raw as RawCampaign[];
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RawCampaign[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const listCampaignsForSelectionTool = (userId: string, orgId: string, conversationId: string) =>
  tool({
    description:
      "Lista as campanhas Meta da empresa para o usuário escolher uma antes de operações focadas (pausar, editar, diagnóstico). Use SEMPRE que o usuário pedir ação Meta sem indicar a campanha.",
    inputSchema: z.object({
      filter: z.enum(["active", "paused", "all"]).default("active").describe("Filtrar por status. Padrão: active"),
    }),
    execute: async ({ filter }) => {
      const statuses = filter === "active" ? ["ACTIVE"] : filter === "paused" ? ["PAUSED", "CAMPAIGN_PAUSED"] : null;
      const read = await runMetaMcpRead({
        organizationId: orgId,
        userId,
        conversationId,
        toolName: "ads_get_ad_entities",
        args: {
          level: "campaign",
          fields: ["id", "name", "effective_status", "objective", "daily_budget"],
          limit: 25,
          ...(statuses ? { filtering: [{ field: "effective_status", operator: "IN", value: statuses }] } : {}),
        },
      });
      if (!read.ok) return read;

      const campaigns = parseEntities(read.result).filter((campaign) => campaign.id);
      return {
        ok: true as const,
        requiresCampaignSelection: true,
        campaigns: campaigns.map((campaign) => {
          const dailyBudget = typeof campaign.daily_budget === "object" ? campaign.daily_budget?.value : campaign.daily_budget;
          return {
            metaCampaignId: campaign.id as string,
            name: campaign.name ?? (campaign.id as string),
            status: campaign.status ?? campaign.effective_status ?? null,
            effectiveStatus: campaign.effective_status ?? null,
            objective: campaign.objective ?? null,
            dailyBudgetReais: dailyBudget ? Number(dailyBudget) : undefined,
          };
        }),
        message:
          campaigns.length > 0
            ? `Encontrei ${campaigns.length} campanha${campaigns.length === 1 ? "" : "s"}. Selecione qual você quer trabalhar:`
            : "Não há campanhas com esse status na conta.",
      };
    },
  });
