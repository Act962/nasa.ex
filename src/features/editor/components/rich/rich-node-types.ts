// Quais quadros têm desenho próprio na visão "Visual" do editor (spec 0090, seção B).
// Os demais continuam como ícone nas duas visões.

export const RICH_TRIGGER_TYPES = new Set([
  "MANUAL_TRIGGER",
  "NEW_LEAD",
  "MOVE_LEAD_STATUS",
  "LEAD_TAGGED",
  "AI_FINISHED",
  "FIRST_CHAT_INTERACTION",
  "LAST_INBOUND_TIMEOUT",
  "FIRST_INTERACTION_OF_DAY",
  "PAYMENT_RECEIVED",
  "MESSAGE_INCOMING",
  "WEBHOOK_EXTERNAL",
  "SCHEDULE_TRIGGER",
  "COMPLIANCE_ITEM_DUE",
]);

export const RICH_MESSAGE_TYPES = new Set(["SEND_MESSAGE", "SEND_MEDIA", "SEND_VOICE"]);

export function hasRichPreview(nodeType: string | undefined): boolean {
  return Boolean(nodeType) && (RICH_TRIGGER_TYPES.has(nodeType!) || RICH_MESSAGE_TYPES.has(nodeType!));
}

/** Tamanho aproximado do quadro na visão Visual, para o "Organizar" não sobrepor. */
export function richNodeSize(nodeType: string | undefined): { width: number; height: number } | null {
  if (!nodeType) return null;
  if (RICH_TRIGGER_TYPES.has(nodeType)) return { width: 250, height: 130 };
  if (RICH_MESSAGE_TYPES.has(nodeType)) return { width: 200, height: 250 };
  return null;
}
