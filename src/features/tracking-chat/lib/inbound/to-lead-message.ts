/**
 * Converte uma mensagem canônica de inbound no `leadMessage` que acompanha os
 * gatilhos de workflow (spec 0008).
 *
 * Só tipos que carregam texto do lead produzem conteúdo. Localização, contato,
 * reação e revoke devolvem `text: ""` — não há o que comparar num filtro.
 */
import {
  truncateLeadMessageText,
  type LeadMessageMediaType,
  type WorkflowLeadMessage,
} from "@/features/tracking-executions/lib/lead-message";
import type { CanonicalInboundMessage } from "../providers/types";

function extractText(canonical: CanonicalInboundMessage): string {
  switch (canonical.type) {
    case "text":
      return canonical.body;
    case "media":
      return canonical.caption ?? "";
    case "interactive_reply":
      return canonical.replyText ?? canonical.replyId ?? "";
    default:
      return "";
  }
}

function extractMediaType(
  canonical: CanonicalInboundMessage,
): LeadMessageMediaType | undefined {
  return canonical.type === "media" ? canonical.kind : undefined;
}

export function canonicalToLeadMessage(
  canonical: CanonicalInboundMessage,
): WorkflowLeadMessage {
  const mediaType = extractMediaType(canonical);

  return {
    text: truncateLeadMessageText(extractText(canonical)),
    messageId: canonical.externalMessageId,
    ...(mediaType ? { mediaType } : {}),
    sentAt: canonical.sentAt.toISOString(),
    source: "TRIGGER_EVENT",
  };
}
