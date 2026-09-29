// Filtros de canal da lista de conversas. "CATALOG", "IN_CHAT" e "ASTRO_CHAT" são pseudo-canais:
// filtram por lead.source. "EMAIL" não vira query — abre o painel do Gmail (spec 0030).
export const CONVERSATION_CHANNEL_FILTERS = [
  "WHATSAPP",
  "INSTAGRAM",
  "TIKTOK",
  "FACEBOOK",
  "EMAIL",
  "IN_CHAT",
  "ASTRO_CHAT",
  "CATALOG",
] as const;

export type ConversationChannelFilter =
  (typeof CONVERSATION_CHANNEL_FILTERS)[number];

export type ChannelFilter = "ALL" | ConversationChannelFilter;

export const CATALOG_CHANNEL_LABEL = "Catálogo online";
