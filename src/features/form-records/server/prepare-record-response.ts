import "server-only";
import prisma from "@/lib/prisma";
import { CALCULATION_BLOCK_TYPE, computeCalculations } from "@/features/form-records/lib/calculation";
import { ITEM_LIST_BLOCK_TYPE, collectProductIds, priceItemLists } from "@/features/form-records/lib/item-list-value";
import { flattenBlocks, parseResponse } from "@/features/form-records/lib/response-values";

/**
 * Antes de gravar uma resposta: põe o preço do catálogo nas listas de itens e
 * recalcula os campos de cálculo (spec 0075, RF-2/RF-3). O que o navegador
 * mandou nesses dois tipos de campo é descartado, exceto as quantidades.
 *
 * Formulário sem esses blocos devolve a string original, intacta.
 */
export async function prepareRecordResponse(params: {
  organizationId: string;
  jsonBlock: unknown;
  response: string;
  /** Resposta já salva (edição): preserva o preço de quando foi preenchida. */
  previousResponse?: unknown;
}): Promise<string> {
  const blocks = flattenBlocks(params.jsonBlock);
  const computedBlockIds = blocks
    .filter((block) => block.blockType === ITEM_LIST_BLOCK_TYPE || block.blockType === CALCULATION_BLOCK_TYPE)
    .map((block) => block.id);
  if (computedBlockIds.length === 0) return params.response;

  let rawResponse: Record<string, unknown>;
  try {
    const parsedJson: unknown = JSON.parse(params.response);
    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) return params.response;
    rawResponse = parsedJson as Record<string, unknown>;
  } catch {
    return params.response;
  }

  const productIds = collectProductIds(blocks);
  const products =
    productIds.length > 0
      ? await prisma.forgeProduct.findMany({
          where: { organizationId: params.organizationId, id: { in: productIds } },
          select: { id: true, value: true },
        })
      : [];
  const priceCentsByProductId = new Map(
    products.map((product) => [product.id, Math.round(Number(product.value) * 100)] as const),
  );

  const priced = priceItemLists({
    blocks,
    response: parseResponse(rawResponse),
    previousResponse: params.previousResponse ? parseResponse(params.previousResponse) : undefined,
    priceCentsByProductId,
  });
  const computed = computeCalculations({ blocks, response: priced });

  // Só os campos calculados são reescritos: o resto da resposta fica byte a byte.
  for (const blockId of computedBlockIds) {
    if (computed[blockId]) rawResponse[blockId] = computed[blockId];
    else delete rawResponse[blockId];
  }
  return JSON.stringify(rawResponse);
}
