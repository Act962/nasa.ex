// Filtros de canal da lista de conversas. "CATALOG" é pseudo-canal: filtra por lead.source = NERP_CATALOG.
export const CONVERSATION_CHANNEL_FILTERS = [
  "WHATSAPP",
  "INSTAGRAM",
  "TIKTOK",
  "FACEBOOK",
  "CATALOG",
] as const;

export type ConversationChannelFilter =
  (typeof CONVERSATION_CHANNEL_FILTERS)[number];

export type ChannelFilter = "ALL" | ConversationChannelFilter;

export const CATALOG_CHANNEL_LABEL = "Catálogo online";
