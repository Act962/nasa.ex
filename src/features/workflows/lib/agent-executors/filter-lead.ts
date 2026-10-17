import "server-only";
import type { FilterLeadFormValues } from "@/features/tracking-executions/components/filter-lead/dialog";
import { evaluateLeadFilter } from "@/features/tracking-executions/lib/filter-conditions";
import {
  truncateLeadMessageText,
  type WorkflowLeadMessage,
} from "@/features/tracking-executions/lib/lead-message";
import type { NodeExecutor } from "../run-workflow";

// "Filtrar Leads" no Modo Agente (spec 0112). Sem ligação nessa saída, o caminho termina ali.
const FILTERED_OUTPUT = "filtered";

function isWorkflowLeadMessage(value: unknown): value is WorkflowLeadMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

/**
 * Os gatilhos do motor clássico mandam `leadMessage` pronto; o "Mensagem Recebida" do Modo
 * Agente manda `messageText` e `messageId` soltos no payload.
 */
function leadMessageFromTrigger(
  trigger: Record<string, unknown> | undefined,
): WorkflowLeadMessage | undefined {
  if (!trigger) return undefined;
  if (isWorkflowLeadMessage(trigger.leadMessage)) return trigger.leadMessage;

  const messageText =
    typeof trigger.messageText === "string" ? trigger.messageText : null;
  const messageId =
    typeof trigger.messageId === "string" ? trigger.messageId : undefined;
  if (messageText === null && !messageId) return undefined;

  return {
    text: truncateLeadMessageText(messageText ?? ""),
    messageId,
    source: "TRIGGER_EVENT",
  };
}

export const filterLeadAgentExecutor: NodeExecutor = async ({
  data,
  context,
}) => {
  const filter = (data.action ?? data) as FilterLeadFormValues;
  if (!Array.isArray(filter.conditions) || filter.conditions.length === 0) {
    return { output: { passed: true } };
  }

  const leadId = context.lead?.id ? String(context.lead.id) : null;
  if (!leadId) {
    return {
      output: { passed: false, reason: "sem lead no fluxo" },
      chosenOutput: FILTERED_OUTPUT,
    };
  }

  const isSatisfied = await evaluateLeadFilter({
    filter,
    leadId,
    leadMessage: leadMessageFromTrigger(context.trigger),
  });

  if (isSatisfied === null) {
    return {
      output: { passed: false, reason: "lead não encontrado" },
      chosenOutput: FILTERED_OUTPUT,
    };
  }
  return isSatisfied
    ? { output: { passed: true } }
    : { output: { passed: false }, chosenOutput: FILTERED_OUTPUT };
};
