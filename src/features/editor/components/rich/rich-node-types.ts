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

/** Ações que mostram um cartão de resumo: o que o passo faz, sem abrir a configuração. */
export const RICH_ACTION_TYPES = new Set([
  "RESPONSIBLE",
  "MOVE_LEAD",
  "TAG",
  "TEMPERATURE",
  "WIN_LOSS",
  "FILTER_LEAD",
  "SEND_PROPOSAL",
  "SEND_CONTRACT",
  "SEND_AGENDA",
  "SEND_FORM",
  "SEND_LINNKER",
  "SEND_NBOX",
  "SEND_NASA_ROUTE",
  "SEND_EMAIL",
]);

export function hasRichPreview(nodeType: string | undefined): boolean {
  return (
    Boolean(nodeType) &&
    (RICH_TRIGGER_TYPES.has(nodeType!) || RICH_MESSAGE_TYPES.has(nodeType!) || RICH_ACTION_TYPES.has(nodeType!))
  );
}

/** Tamanho aproximado do quadro na visão Visual, para o "Organizar" não sobrepor. */
export function richNodeSize(nodeType: string | undefined): { width: number; height: number } | null {
  if (!nodeType) return null;
  if (RICH_TRIGGER_TYPES.has(nodeType)) return { width: 250, height: 130 };
  if (RICH_MESSAGE_TYPES.has(nodeType)) return { width: 200, height: 250 };
  if (RICH_ACTION_TYPES.has(nodeType)) return { width: 200, height: 90 };
  return null;
}
