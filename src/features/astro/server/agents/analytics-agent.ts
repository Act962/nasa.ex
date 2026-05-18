import "server-only";
import { ANALYTICS_AGENT_PROMPT } from "@/features/astro/lib/prompts";
import { buildAnalyticsTools } from "@/features/astro/server/tools/analytics";
import { buildListTools } from "@/features/astro/server/tools/lists";
import { buildSearchTools } from "@/features/astro/server/tools/search";
import { buildKnowledgeTools } from "@/features/astro/server/tools/knowledge";
import type { AgentDefinition } from "./types";

/**
 * Sub-agente ANALYTICS — responde perguntas do usuário sobre indicadores
 * de cada app do NASA. Lê dados reais do banco com filtros de período,
 * organização, user e app.
 *
 * Exemplos de pedido:
 *   - "Quantos leads ativos eu tenho?"
 *   - "Quem foi o mais ativo essa semana?"
 *   - "Qual a conversão do tracking de vendas?"
 *   - "Quantos stars eu consumi esse mês?"
 *
 * Estratégia incremental: agente cobre hoje atividade + tracking. Próximas
 * sessões adicionam: chat, workspace, forms, agenda, forge, nasa-route,
 * linnker, nbox, financeiro, integrações, space help.
 */
export const analyticsAgent: AgentDefinition = {
  key: "analytics-agent",
  displayName: "Analytics Agent",
  shortDescription:
    "Responde sobre indicadores e métricas: leads, conversão, tempo ativo, stars consumidos, top users, etc. Lê dados reais do banco com filtros de período e organização.",
  systemPrompt: ANALYTICS_AGENT_PROMPT,
  buildTools: (ctx) => ({
    ...buildAnalyticsTools(ctx),
    ...buildListTools(ctx),
    ...buildSearchTools(ctx),
    ...buildKnowledgeTools(ctx, "analytics-agent"),
  }),
};
