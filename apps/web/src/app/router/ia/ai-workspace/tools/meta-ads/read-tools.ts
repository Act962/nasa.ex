import { tool } from "ai";
import { z } from "zod";
import { debitMetaToolStars, setupMetaTool } from "./_shared";

/**
 * Visão geral da conta Meta — totais agregados de spend, alcance, etc.
 * Não exige campanha ativa. 1 ★.
 */
export const getAccountOverviewTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Visão geral da conta Meta Ads no período: total investido, alcance, impressões, conversões. Use quando o usuário perguntar 'como estão minhas campanhas no geral' ou similar.",
    inputSchema: z.object({
      datePreset: z
        .enum(["today", "yesterday", "last_7d", "last_30d", "last_90d"])
        .default("last_30d"),
    }),
    execute: async ({ datePreset }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const insights = await setup.client.getInsights({
          level: "account",
          datePreset,
        });
        await debitMetaToolStars(orgId, userId, "account_overview", 1);
        return { ok: true as const, datePreset, kpis: insights };
      } finally {
        await setup.close();
      }
    },
  });

/**
 * Insights detalhados por campanha (ou geral se sem campaignId).
 * Não exige campanha ativa (mas usa se fornecida). 1 ★.
 */
export const getInsightsTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Métricas detalhadas (alcance, CTR, CPC, CPM, conversões, ROAS) de uma campanha específica ou da conta toda. Passe campaignId quando o usuário falar de campanha específica.",
    inputSchema: z.object({
      campaignId: z.string().optional().describe("metaCampaignId (opcional)"),
      datePreset: z
        .enum(["today", "yesterday", "last_7d", "last_30d", "last_90d"])
        .default("last_30d"),
    }),
    execute: async ({ campaignId, datePreset }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const insights = await setup.client.getInsights({
          level: campaignId ? "campaign" : "account",
          entityId: campaignId,
          datePreset,
        });
        await debitMetaToolStars(orgId, userId, "get_insights", 1);
        return {
          ok: true as const,
          scope: campaignId ? "campaign" : "account",
          campaignId: campaignId ?? null,
          datePreset,
          kpis: insights,
        };
      } finally {
        await setup.close();
      }
    },
  });

/**
 * Diagnóstico de uma campanha (ou ad). EXIGE campanha selecionada. 2 ★.
 *
 * Por enquanto retorna heurísticas básicas baseadas nos KPIs (CTR, CPM,
 * frequência) — quando o MCP server da Meta tiver endpoint de diagnostics
 * oficial, swap em `client.ts`.
 */
export const getDiagnosticsTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Diagnóstico de saúde de uma campanha: identifica problemas (CTR baixo, CPM alto, fadiga de criativo). EXIGE campaignId. Use quando o usuário pedir 'o que tá errado com X' ou 'analisa essa campanha'.",
    inputSchema: z.object({
      campaignId: z.string().min(1),
      datePreset: z
        .enum(["last_7d", "last_30d"])
        .default("last_7d"),
    }),
    execute: async ({ campaignId, datePreset }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const k = await setup.client.getInsights({
          level: "campaign",
          entityId: campaignId,
          datePreset,
        });
        const issues: { severity: "info" | "warn" | "error"; message: string; recommendation: string }[] = [];
        if (k.ctr < 0.8) {
          issues.push({
            severity: "warn",
            message: `CTR ${k.ctr.toFixed(2)}% abaixo da média (1.0%-2.0%).`,
            recommendation: "Considere testar novos criativos ou refinar audiência.",
          });
        }
        if (k.cpm > 30) {
          issues.push({
            severity: "warn",
            message: `CPM R$ ${k.cpm.toFixed(2)} alto.`,
            recommendation: "Audiência pode estar saturada — amplie ou pause.",
          });
        }
        if (k.cpa > 0 && k.spend > 50 && k.cpa > k.spend / Math.max(1, k.conversions / 2)) {
          issues.push({
            severity: "info",
            message: `Custo por conversão R$ ${k.cpa.toFixed(2)} acima do esperado.`,
            recommendation: "Ajuste lance ou otimize criativos pra reduzir CPA.",
          });
        }
        if (k.conversions === 0 && k.spend > 20) {
          issues.push({
            severity: "error",
            message: `Sem conversões com R$ ${k.spend.toFixed(2)} investidos.`,
            recommendation: "Revisite criativos, audiência e oferta antes de continuar gastando.",
          });
        }
        const score =
          issues.length === 0 ? 95 :
          issues.some((i) => i.severity === "error") ? 35 :
          issues.some((i) => i.severity === "warn") ? 60 : 80;
        await debitMetaToolStars(orgId, userId, "get_diagnostics", 2);
        return {
          ok: true as const,
          campaignId,
          score,
          issues,
          kpis: k,
        };
      } finally {
        await setup.close();
      }
    },
  });

/**
 * Lista catálogos / feeds de produtos da conta. 1 ★.
 * Hoje retorna stub — quando MCP/CLI da Meta expor catalogs, swap em client.ts.
 */
export const listCatalogsTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Lista catálogos de produtos vinculados à conta Meta. Use quando o usuário falar de 'feed', 'catálogo' ou 'produtos no anúncio'.",
    inputSchema: z.object({}),
    execute: async () => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        await debitMetaToolStars(orgId, userId, "list_catalogs", 1);
        return {
          ok: true as const,
          catalogs: [],
          message:
            "Listagem de catálogos será habilitada quando o MCP server da Meta expor o endpoint de catalogs ou quando configurarmos a Marketing API correspondente. (Stub temporário)",
        };
      } finally {
        await setup.close();
      }
    },
  });
