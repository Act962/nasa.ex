import "server-only";
import type { AgentKey } from "@/features/astro/schemas/agent-config";
import { closerAgent } from "./closer";
import { taskAgent } from "./task-agent";
import { automationAgent } from "./automation-agent";
import type { AgentDefinition } from "./types";

/**
 * Registro central dos sub-agentes do ASTRO.
 *
 * Para adicionar um agente novo:
 *   1. Criar `src/features/astro/server/agents/<nome>.ts` exportando um `AgentDefinition`.
 *   2. Adicionar a key em `AGENT_KEYS` (em `schemas/agent-config.ts`).
 *   3. Importar e incluir aqui no array.
 *
 * O orquestrador descobre via este array — não há outro ponto de registro.
 */
export const AGENTS: AgentDefinition[] = [
  closerAgent,
  taskAgent,
  automationAgent,
];

const byKey = new Map(AGENTS.map((a) => [a.key, a]));

export function getAgent(key: AgentKey): AgentDefinition | undefined {
  return byKey.get(key);
}

export function listEnabledAgents(
  enabled: Record<AgentKey, boolean>,
): AgentDefinition[] {
  return AGENTS.filter((a) => enabled[a.key] !== false);
}
