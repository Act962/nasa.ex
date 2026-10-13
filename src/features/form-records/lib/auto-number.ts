// Campo "Número automático" (spec 0075, RF-13): o número é dado pelo servidor
// quando a ficha é criada e nunca mais muda. O que o navegador mandar nesse
// campo é ignorado.

import { flattenBlocks, parseResponse } from "@/features/form-records/lib/response-values";

export const AUTO_NUMBER_BLOCK_TYPE = "AutoNumber";
export const AUTO_NUMBER_KIND = "auto-number";
export const AUTO_NUMBER_MAX_DIGITS = 10;

export function hasAutoNumberBlock(jsonBlock: unknown): boolean {
  return flattenBlocks(jsonBlock).some((block) => block.blockType === AUTO_NUMBER_BLOCK_TYPE);
}

function toBoundedInteger(raw: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

export function formatAutoNumber(sequence: number, attributes: Record<string, unknown> | undefined): string {
  const startAt = toBoundedInteger(attributes?.startAt, 1, 1, 999_999_999);
  const digits = toBoundedInteger(attributes?.digits, 5, 1, AUTO_NUMBER_MAX_DIGITS);
  const prefix = typeof attributes?.prefix === "string" ? attributes.prefix.trim().slice(0, 12) : "";
  return `${prefix}${String(startAt - 1 + sequence).padStart(digits, "0")}`;
}

/**
 * Reescreve só os campos de número automático da resposta.
 * - Criação (`sequence` informado): recebe o próximo número.
 * - Edição (`previousResponse`): mantém o número já gravado.
 * Formulário sem esse campo devolve a string original, intacta.
 */
export function applyAutoNumbers(params: {
  jsonBlock: unknown;
  response: string;
  sequence?: number;
  previousResponse?: unknown;
}): string {
  const autoNumberBlocks = flattenBlocks(params.jsonBlock).filter((block) => block.blockType === AUTO_NUMBER_BLOCK_TYPE);
  if (autoNumberBlocks.length === 0) return params.response;

  let rawResponse: Record<string, unknown>;
  try {
    const parsedJson: unknown = JSON.parse(params.response);
    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) return params.response;
    rawResponse = parsedJson as Record<string, unknown>;
  } catch {
    return params.response;
  }

  const previous = params.previousResponse ? parseResponse(params.previousResponse) : {};
  for (const block of autoNumberBlocks) {
    const previousEntry = previous[block.id];
    if (previousEntry?.value) {
      rawResponse[block.id] = previousEntry;
    } else if (params.sequence !== undefined) {
      rawResponse[block.id] = {
        value: formatAutoNumber(params.sequence, block.attributes),
        meta: { kind: AUTO_NUMBER_KIND, version: 1, sequence: params.sequence },
      };
    } else {
      delete rawResponse[block.id];
    }
  }
  return JSON.stringify(rawResponse);
}
