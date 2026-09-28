import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { buildFinanceListTools } from "./read-lists";
import { buildFinanceReportTools } from "./read-reports";

// Tools de LEITURA do financeiro (spec 0014, RF-2). Todas single-org
// (`ctx.organizationId`) e todas passam pela matriz de permissão do módulo.

export function buildFinanceReadTools(ctx: AgentContext) {
  return {
    ...buildFinanceReportTools(ctx),
    ...buildFinanceListTools(ctx),
  };
}
