// Etapas padrão do pedido do catálogo (spec 0044). Só dados — seguro no client.

/** `metadata.kind` da mensagem de aviso de etapa (chat, portal e WhatsApp). */
export const CATALOG_NOTICE_KIND = "catalog_order_notice";

export const CATALOG_STAGE_KEYS = {
  new: "catalog.new",
  confirmed: "catalog.confirmed",
  paid: "catalog.paid",
  separated: "catalog.separated",
  delivered: "catalog.delivered",
} as const;

export type CatalogStageKey = (typeof CATALOG_STAGE_KEYS)[keyof typeof CATALOG_STAGE_KEYS];

export type CatalogStage = { key: CatalogStageKey; name: string; color: string; tagSlug: string; tagColor: string };

export const CATALOG_STAGES: CatalogStage[] = [
  { key: CATALOG_STAGE_KEYS.new, name: "Novo Pedido", color: "#3b82f6", tagSlug: "etapa-novo-pedido", tagColor: "#3b82f6" },
  { key: CATALOG_STAGE_KEYS.confirmed, name: "Confirmado", color: "#06b6d4", tagSlug: "etapa-confirmado", tagColor: "#06b6d4" },
  { key: CATALOG_STAGE_KEYS.paid, name: "Pagamento confirmado", color: "#10b981", tagSlug: "etapa-pagamento-confirmado", tagColor: "#10b981" },
  { key: CATALOG_STAGE_KEYS.separated, name: "Separado", color: "#f59e0b", tagSlug: "etapa-separado", tagColor: "#f59e0b" },
  { key: CATALOG_STAGE_KEYS.delivered, name: "Entregue", color: "#22c55e", tagSlug: "etapa-entregue", tagColor: "#22c55e" },
];

export const CATALOG_STAGE_TAG_SLUGS = CATALOG_STAGES.map((stage) => stage.tagSlug);

export function isCatalogStageKey(value: string | null | undefined): value is CatalogStageKey {
  return CATALOG_STAGES.some((stage) => stage.key === value);
}

export function catalogStageIndex(key: CatalogStageKey): number {
  return CATALOG_STAGES.findIndex((stage) => stage.key === key);
}

export function findCatalogStage(key: CatalogStageKey): CatalogStage {
  const stage = CATALOG_STAGES.find((candidate) => candidate.key === key);
  if (!stage) throw new Error(`Etapa de catálogo desconhecida: ${key}`);
  return stage;
}

/** Retirada vem em texto livre do NERP ("Retirada na loja", "retirar no balcão"...). Vazio = entrega. */
export function isPickupDelivery(deliveryMethod: string | null | undefined): boolean {
  return /retir/i.test(deliveryMethod ?? "");
}
