import "server-only";
import type { ToolSet } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  buildFinanceReadTools,
  buildFinanceWriteTools,
} from "@/features/astro/server/tools/finance";
import { FINANCE_SCOPE_PROMPT } from "@/features/astro/lib/prompts/finance";

/**
 * Registro dos "packs" de tools por app (spec 0014, D-1). É o ponto de
 * entrada da integração Astro × ferramentas do Órbita: cada app expõe leitura
 * e escrita separadas + o bloco de prompt que explica como usá-las. Um app
 * novo (NERP, ...) entra como chave nova — o orquestrador não muda.
 */
export interface AppToolPack {
  appSlug: string;
  read: (ctx: AgentContext) => ToolSet;
  write: (ctx: AgentContext) => ToolSet;
  systemPrompt: string;
}

export const APP_TOOL_PACKS: Record<string, AppToolPack> = {
  payment: {
    appSlug: "payment",
    read: buildFinanceReadTools,
    write: buildFinanceWriteTools,
    systemPrompt: FINANCE_SCOPE_PROMPT,
  },
};

export function listAppToolPacks(): AppToolPack[] {
  return Object.values(APP_TOOL_PACKS);
}
