import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { assertPaymentToolAccess, type FinanceAccessResult } from "@/features/astro/server/tools/finance/access";

// A aba Contábil herda o acesso do financeiro (mesma regra do
// `accountingReadProcedure`): quem vê o painel do Payment lê o contábil.
export function assertAccountingReadAccess(ctx: AgentContext): Promise<FinanceAccessResult> {
  return assertPaymentToolAccess(ctx, "dashboard", "view");
}

export const ACCOUNTING_TAB_URL = "/payment?tab=accounting";
