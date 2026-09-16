import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
// Registra os executores de extrato/conciliação no registro global.
import "./statement-executors";
import { buildStatementImportTools } from "./statement-import-tools";
import { buildStatementReconciliationTools } from "./statement-reconciliation-tools";
import { buildStatementTransactionTools } from "./statement-transaction-tools";

// Tools de extrato e conciliação do pack financeiro (spec 0016). Leitura e
// propostas juntas: todas dependem de `confirm_action` para escrever.

export function buildFinanceStatementTools(ctx: AgentContext) {
  return {
    ...buildStatementImportTools(ctx),
    ...buildStatementReconciliationTools(ctx),
    ...buildStatementTransactionTools(ctx),
  };
}
