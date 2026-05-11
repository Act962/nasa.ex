/**
 * Deriva o **título customizado** de uma resposta de formulário a partir do
 * valor de um bloco do form marcado como `attributes.useAsResponseLabel`.
 *
 * Regras:
 *  - Walka todos os blocos (incluindo `childblocks` aninhados) e pega o
 *    PRIMEIRO encontrado em ordem de DOM com `useAsResponseLabel === true`.
 *  - Lê o valor correspondente em `jsonResponse[blockId]`. Aceita formato
 *    novo `{ value, meta? }` ou string crua antiga.
 *  - Trim + limit 80 caracteres.
 *  - Se vazio/ausente → retorna `null` (nada a auto-preencher).
 *
 * Usado server-side em `createResponseForLead`, `submitResponse` e
 * `updateResponse` *antes* do save, somente quando
 * `FormResponses.labelManuallyEdited === false` (manual prevalece sobre
 * auto-derive).
 */
const MAX_LABEL_LENGTH = 80;

type AnyBlock = {
  id?: string;
  attributes?: { useAsResponseLabel?: boolean };
  childblocks?: AnyBlock[];
};

type ParsedResponse = Record<
  string,
  { value?: unknown; meta?: Record<string, unknown> } | string | unknown
>;

function parseJsonBlock(jsonBlock: unknown): AnyBlock[] {
  if (Array.isArray(jsonBlock)) return jsonBlock as AnyBlock[];
  if (typeof jsonBlock === "string") {
    try {
      const parsed = JSON.parse(jsonBlock);
      return Array.isArray(parsed) ? (parsed as AnyBlock[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonResponse(jsonResponse: unknown): ParsedResponse {
  if (!jsonResponse) return {};
  if (typeof jsonResponse === "string") {
    try {
      return JSON.parse(jsonResponse) as ParsedResponse;
    } catch {
      return {};
    }
  }
  if (typeof jsonResponse === "object") return jsonResponse as ParsedResponse;
  return {};
}

function findFirstLabelBlockId(blocks: AnyBlock[]): string | null {
  for (const b of blocks) {
    if (b?.attributes?.useAsResponseLabel === true && typeof b.id === "string") {
      return b.id;
    }
    if (Array.isArray(b?.childblocks)) {
      const nested = findFirstLabelBlockId(b.childblocks);
      if (nested) return nested;
    }
  }
  return null;
}

function readValue(entry: unknown): string | null {
  if (entry == null) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "object") {
    const e = entry as { value?: unknown };
    if (typeof e.value === "string") return e.value;
  }
  return null;
}

export function deriveResponseLabel(input: {
  jsonBlock: unknown;
  jsonResponse: unknown;
}): string | null {
  const blocks = parseJsonBlock(input.jsonBlock);
  const labelBlockId = findFirstLabelBlockId(blocks);
  if (!labelBlockId) return null;
  const parsed = parseJsonResponse(input.jsonResponse);
  const raw = readValue(parsed[labelBlockId]);
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_LABEL_LENGTH);
}
