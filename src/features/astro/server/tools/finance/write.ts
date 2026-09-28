import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { buildEntryChangeTools } from "./propose-entry-changes";
import { buildEntryProposalTools } from "./propose-entry";

// Tools de ESCRITA do financeiro (spec 0014, RF-3/RF-10/RF-11): todas
// propõem; só `create_payment_category` grava direto.

export function buildFinanceWriteTools(ctx: AgentContext) {
  return {
    ...buildEntryProposalTools(ctx),
    ...buildEntryChangeTools(ctx),
  };
}
