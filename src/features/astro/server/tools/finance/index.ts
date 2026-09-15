import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
// Registra os executores das propostas financeiras no registro global.
import "./executors";
import { buildFinanceReadTools } from "./read";
import { buildFinanceDocumentTools } from "./documents";
import { buildFinanceWriteTools as buildFinanceMutationTools } from "./write";

/**
 * Pack de tools do NASA Payment (spec 0014, D-1). `read` entra em qualquer
 * escopo que enxergue financeiro; `write` só onde há confirmação disponível
 * (`confirm_action`), ou seja, escopos full e assistant.
 */
export { buildFinanceReadTools };

export function buildFinanceWriteTools(ctx: AgentContext) {
  return {
    ...buildFinanceDocumentTools(ctx),
    ...buildFinanceMutationTools(ctx),
  };
}
