import type { Tool } from "ai";
import type { AgentKey } from "@/features/astro/schemas/agent-config";
import type { AstroRouteContext } from "@/features/astro/schemas/chat-message";

/**
 * Contexto de execução compartilhado entre o orquestrador, sub-agentes e tools.
 * Tudo que uma tool precisa para validar permissões e personalizar a resposta
 * deve estar aqui — não acoplar a cookies/headers HTTP dentro de tool.
 */
export interface AgentContext {
  userId: string;
  organizationId: string;
  /** Snapshot dos IDs da rota atual quando aplicável. */
  route: AstroRouteContext;
  /** Sub-agente fixado em embeds (`pinnedAgentKey` no body). */
  pinnedAgentKey?: AgentKey;
}

/**
 * Definição declarativa de um sub-agente. Cada item no `registry.ts` segue
 * este shape; o orquestrador descobre as definições e gera tools de roteamento
 * automaticamente.
 */
export interface AgentDefinition {
  key: AgentKey;
  /** Nome humano para UI (Settings, banners). */
  displayName: string;
  /** Descrição curta — vira tool description do orquestrador. */
  shortDescription: string;
  /** System prompt do sub-agente (sem placeholders dinâmicos aqui). */
  systemPrompt: string;
  /**
   * Builder de tools. Recebe o contexto da requisição e retorna um record de
   * `Tool` do AI SDK. Lazy: tools são montadas por requisição para fechar sobre
   * `userId`/`organizationId`.
   */
  buildTools: (ctx: AgentContext) => Record<string, Tool>;
  /** Modelo default (override por env / config futura). */
  defaultModelId?: string;
}
