import type { WorkflowLeadMessage } from "@/features/tracking-executions/lib/lead-message";
import { truncateLeadMessageText } from "@/features/tracking-executions/lib/lead-message";

function isWorkflowLeadMessage(value: unknown): value is WorkflowLeadMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

/**
 * Mensagem do cliente que disparou o fluxo. Os gatilhos do motor clássico mandam `leadMessage`
 * pronto; o "Mensagem Recebida" do Modo Agente manda `messageText` e `messageId` soltos.
 */
export function leadMessageFromTrigger(
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
