import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { buildAccountingGlossaryTools } from "./glossary";
import { buildAccountingProfileTools } from "./profile";
import { buildAccountingSimulationTools } from "./simulations";
import { buildAccountingComplianceTools } from "./compliance";
import { buildAccountingPricingTools } from "./pricing";
import { buildAccountingOverviewTools } from "./overview";
import { buildAccountingBooksTools } from "./books";
import { buildAccountingReferenceTools } from "./reference";

/**
 * Pack contábil do ASTRO (spec 0051, RF-17). Só LEITURA e simulação: apurar,
 * confirmar guia e anexar documento continuam sendo ações do usuário na aba.
 */
export function buildAccountingReadTools(ctx: AgentContext) {
  return {
    ...buildAccountingOverviewTools(ctx),
    ...buildAccountingGlossaryTools(ctx),
    ...buildAccountingProfileTools(ctx),
    ...buildAccountingSimulationTools(ctx),
    ...buildAccountingComplianceTools(ctx),
    ...buildAccountingPricingTools(ctx),
    ...buildAccountingBooksTools(ctx),
    ...buildAccountingReferenceTools(ctx),
  };
}

export function buildAccountingWriteTools(_ctx: AgentContext) {
  return {};
}

