import { formatCents, roundToDecimals } from "./measure-units";
import type { ParsedResponse, RecordBlock } from "./response-values";

// Valor do bloco "Lista de itens" (spec 0075, RF-2). O navegador só manda a
// quantidade; nome, unidade, modo de cobrança e preço vêm do formulário e do
// catálogo, pelo servidor.

export const ITEM_LIST_KIND = "item-list";
export const ITEM_LIST_BLOCK_TYPE = "ItemList";
const MAX_QUANTITY = 1_000_000;
const QUANTITY_DECIMALS = 4;

export type ItemBillingMode = "USAGE" | "INFO";

export interface ItemListConfigItem {
  /** Id estável do item dentro do bloco: sobrevive a renomear o produto. */
  itemId: string;
  productId: string | null;
  name: string;
  unit: string;
  billingMode: ItemBillingMode;
}

export interface PricedItem extends ItemListConfigItem {
  quantity: number;
  /** `null` = item sem preço no catálogo: entra na ficha, não entra no total. */
  unitPriceCents: number | null;
  lineTotalCents: number;
}

export interface ItemListMeta {
  kind: typeof ITEM_LIST_KIND;
  version: 1;
  items: PricedItem[];
  usageTotalCents: number;
  pricedAt: string;
}

export function readConfigItems(block: RecordBlock): ItemListConfigItem[] {
  const rawItems = block.attributes?.items;
  if (!Array.isArray(rawItems)) return [];
  return rawItems.flatMap((rawItem) => {
    if (!rawItem || typeof rawItem !== "object") return [];
    const item = rawItem as Record<string, unknown>;
    if (typeof item.itemId !== "string" || typeof item.name !== "string") return [];
    return [
      {
        itemId: item.itemId,
        productId: typeof item.productId === "string" ? item.productId : null,
        name: item.name,
        unit: typeof item.unit === "string" ? item.unit : "un",
        billingMode: item.billingMode === "INFO" ? ("INFO" as const) : ("USAGE" as const),
      },
    ];
  });
}

export function parseItemListMeta(meta: Record<string, unknown> | undefined): ItemListMeta | null {
  if (!meta || meta.kind !== ITEM_LIST_KIND || !Array.isArray(meta.items)) return null;
  return meta as unknown as ItemListMeta;
}

function sanitizeQuantity(rawQuantity: unknown): number {
  const quantity = typeof rawQuantity === "number" ? rawQuantity : Number(rawQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return roundToDecimals(Math.min(quantity, MAX_QUANTITY), QUANTITY_DECIMALS);
}

function readQuantities(meta: Record<string, unknown> | undefined): Map<string, number> {
  const quantities = new Map<string, number>();
  const rawItems = meta?.items;
  if (!Array.isArray(rawItems)) return quantities;
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as { itemId?: unknown; quantity?: unknown };
    if (typeof item.itemId === "string") quantities.set(item.itemId, sanitizeQuantity(item.quantity));
  }
  return quantities;
}

export function buildItemListSummary(items: PricedItem[], usageTotalCents: number): string {
  const usedItems = items.filter((item) => item.quantity > 0);
  if (usedItems.length === 0) return "";
  const count = `${usedItems.length} ${usedItems.length === 1 ? "item" : "itens"}`;
  return usageTotalCents > 0 ? `${count} · ${formatCents(usageTotalCents)}` : count;
}

/**
 * Reescreve as entradas de lista de itens com preço e total calculados aqui.
 * Item que já tinha preço na resposta anterior mantém o preço: mudança no
 * catálogo não altera ficha já preenchida.
 */
export function priceItemLists(params: {
  blocks: RecordBlock[];
  response: ParsedResponse;
  previousResponse?: ParsedResponse;
  priceCentsByProductId: Map<string, number>;
  now?: Date;
}): ParsedResponse {
  const priced: ParsedResponse = { ...params.response };
  for (const block of params.blocks) {
    if (block.blockType !== ITEM_LIST_BLOCK_TYPE) continue;
    const entry = params.response[block.id];
    if (!entry) continue;

    const quantities = readQuantities(entry.meta);
    const previousMeta = parseItemListMeta(params.previousResponse?.[block.id]?.meta);
    const previousPriceByItemId = new Map(
      (previousMeta?.items ?? []).map((item) => [item.itemId, item.unitPriceCents] as const),
    );

    const items: PricedItem[] = readConfigItems(block)
      .map((configItem) => {
        const quantity = quantities.get(configItem.itemId) ?? 0;
        const previousPrice = previousPriceByItemId.get(configItem.itemId);
        const catalogPrice = configItem.productId ? params.priceCentsByProductId.get(configItem.productId) : undefined;
        const unitPriceCents = previousPrice ?? catalogPrice ?? null;
        return {
          ...configItem,
          quantity,
          unitPriceCents,
          lineTotalCents: unitPriceCents === null ? 0 : Math.round(quantity * unitPriceCents),
        };
      })
      .filter((item) => item.quantity > 0);

    const usageTotalCents = items
      .filter((item) => item.billingMode === "USAGE")
      .reduce((total, item) => total + item.lineTotalCents, 0);

    const meta: ItemListMeta = {
      kind: ITEM_LIST_KIND,
      version: 1,
      items,
      usageTotalCents,
      pricedAt: (params.now ?? new Date()).toISOString(),
    };
    priced[block.id] = {
      value: buildItemListSummary(items, usageTotalCents),
      meta: meta as unknown as Record<string, unknown>,
    };
  }
  return priced;
}

/** Ids de produto citados nas listas do formulário — para buscar os preços de uma vez. */
export function collectProductIds(blocks: RecordBlock[]): string[] {
  const productIds = new Set<string>();
  for (const block of blocks) {
    if (block.blockType !== ITEM_LIST_BLOCK_TYPE) continue;
    for (const item of readConfigItems(block)) {
      if (item.productId) productIds.add(item.productId);
    }
  }
  return [...productIds];
}
