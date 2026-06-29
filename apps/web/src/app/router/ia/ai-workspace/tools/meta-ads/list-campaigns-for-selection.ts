import { tool } from "ai";
import { z } from "zod";
import { setupMetaTool } from "./_shared";

/**
 * GATEWAY TOOL — chamada antes de qualquer ação focada em campanha.
 *
 * Retorna lista resumida de campanhas pra o usuário escolher uma. Frontend
 * renderiza como cards clicáveis. Não debita Stars.
 *
 * Tools de gestão (pause, update, etc.) chamam essa primeiro se faltar
 * `activeCampaign` no contexto da sessão.
 */
export const listCampaignsForSelectionTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Lista as campanhas Meta da organização para o usuário escolher uma antes de operações focadas (pausar, editar, diagnóstico). Use SEMPRE que o usuário pedir ação Meta sem indicar a campanha específica. Marque a resposta como 'requiresCampaignSelection: true' para o frontend renderizar o picker.",
    inputSchema: z.object({
      filter: z
        .enum(["active", "paused", "all"])
        .default("active")
        .describe("Filtrar campanhas por status. Default: active"),
    }),
    execute: async ({ filter }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const status =
          filter === "active" ? "ACTIVE" : filter === "paused" ? "PAUSED" : "ALL";
        const campaigns = await setup.client.listCampaigns({ status });
        return {
          ok: true as const,
          requiresCampaignSelection: true,
          campaigns: campaigns.map((c) => ({
            metaCampaignId: c.id,
            name: c.name,
            status: c.status,
            effectiveStatus: c.effectiveStatus,
            objective: c.objective,
            dailyBudgetReais: c.dailyBudgetReais,
          })),
          message:
            campaigns.length > 0
              ? `Encontrei ${campaigns.length} campanha${campaigns.length === 1 ? "" : "s"}. Selecione qual você quer trabalhar:`
              : "Não há campanhas com esse status na conta atual.",
        };
      } finally {
        await setup.close();
      }
    },
  });
