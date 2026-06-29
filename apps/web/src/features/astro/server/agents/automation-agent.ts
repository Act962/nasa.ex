import "server-only";
import { AUTOMATION_AGENT_PROMPT } from "@/features/astro/lib/prompts";
import { buildAutomationTools } from "@/features/astro/server/tools/automation";
import { buildKnowledgeTools } from "@/features/astro/server/tools/knowledge";
import { buildSearchTools } from "@/features/astro/server/tools/search";
import type { AgentDefinition } from "./types";

/**
 * Sub-agente AUTOMATION — cria, lista e gerencia regras de alerta
 * (AlertRule) a partir de instrução em linguagem natural no NASA Command.
 *
 * Exemplos de pedido que ele cobre:
 *   - "Me avise quando lead ficar 2 dias parado"
 *   - "Popup urgente se o WhatsApp cair"
 *   - "Notifica o supervisor quando um lead chega no Ganhou"
 *   - "Desliga a regra de proposta paga"
 *
 * Não tem ferramentas de mutação fora de Alerts — pra Actions/Reminders
 * o orquestrador delega pro task-agent, pra leads delega pro closer, etc.
 */
export const automationAgent: AgentDefinition = {
  key: "automation-agent",
  displayName: "Automation Agent",
  shortDescription:
    "Configura regras de alerta — leads parados, agenda começando, integração caída, proposta paga, etc. Tudo em linguagem natural.",
  systemPrompt: AUTOMATION_AGENT_PROMPT,
  buildTools: (ctx) => ({
    ...buildAutomationTools(ctx),
    ...buildSearchTools(ctx),
    ...buildKnowledgeTools(ctx, "automation-agent"),
  }),
};
