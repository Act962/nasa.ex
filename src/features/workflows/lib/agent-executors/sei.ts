import "server-only";

import { executeSeiActionForLead } from "@/features/sei/server/execute-sei-action";
import type { NodeExecutor } from "../run-workflow";

export const seiActionAgentExecutor: NodeExecutor = async ({ data, context, dryRun }) => {
  const leadId = String(context.lead?.id ?? "");
  if (!leadId) {
    return {
      status: "FAILED",
      errorMessage: "Lead obrigatório para consultar o SEI.",
      output: { error: "lead_missing" },
    };
  }
  if (dryRun) {
    return {
      output: {
        vars: {
          sei: {
            protocolo: "00000.000000/2026-00",
            ultimoAndamento: "Andamento simulado",
            linkAcesso: "https://sei.exemplo.gov.br/processo",
          },
        },
      },
    };
  }
  const sei = await executeSeiActionForLead(leadId, {
    protocolo: typeof data.protocolo === "string" ? data.protocolo : undefined,
  });
  return { output: { vars: { sei } } };
};
