import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
// Registram os executores das propostas financeiras no registro global.
import "./executors";
import "./statement-executors";
import "./reminder-executors";
import "./inbox-executors";
import { buildFinanceReadTools } from "./read";
import { buildFinanceDocumentTools } from "./documents";
import { buildFinanceWriteTools as buildFinanceMutationTools } from "./write";
import { buildFinanceStatementTools } from "./statements";
import { buildFinanceReminderTools } from "./reminders";
import { buildFinanceInboxTools } from "./inbox";

/**
 * Pack de tools do NASA Payment (specs 0014, 0016–0018). `read` entra em
 * qualquer escopo que enxergue financeiro; `write` só onde há confirmação
 * disponível (`confirm_action`), ou seja, escopos full e assistant.
 */
export { buildFinanceReadTools };

export function buildFinanceWriteTools(ctx: AgentContext) {
  return {
    ...buildFinanceDocumentTools(ctx),
    ...buildFinanceMutationTools(ctx),
    ...buildFinanceStatementTools(ctx),
    ...buildFinanceReminderTools(ctx),
    ...buildFinanceInboxTools(ctx),
  };
}
