// Leitura tolerante do `jsonResponse` e do `jsonBlock`: a coluna guarda uma
// string JSON dentro do Json, e respostas antigas têm string crua por campo.

export interface ResponseEntry {
  value: string;
  meta?: Record<string, unknown>;
}

export type ParsedResponse = Record<string, ResponseEntry>;

export interface RecordBlock {
  id: string;
  blockType: string;
  attributes?: Record<string, unknown>;
  childblocks?: RecordBlock[];
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseResponse(jsonResponse: unknown): ParsedResponse {
  const parsed = parseJson(jsonResponse);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const entries: ParsedResponse = {};
  for (const [blockId, rawEntry] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof rawEntry === "string") {
      entries[blockId] = { value: rawEntry };
      continue;
    }
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const candidate = rawEntry as { value?: unknown; meta?: unknown };
    if (typeof candidate.value !== "string") continue;
    entries[blockId] = {
      value: candidate.value,
      meta:
        candidate.meta && typeof candidate.meta === "object" && !Array.isArray(candidate.meta)
          ? (candidate.meta as Record<string, unknown>)
          : undefined,
    };
  }
  return entries;
}

/** Todos os blocos de campo, com os filhos dos grupos achatados em ordem. */
export function flattenBlocks(jsonBlock: unknown): RecordBlock[] {
  const parsed = parseJson(jsonBlock);
  if (!Array.isArray(parsed)) return [];
  const flat: RecordBlock[] = [];
  const visit = (blocks: unknown[]) => {
    for (const rawBlock of blocks) {
      if (!rawBlock || typeof rawBlock !== "object") continue;
      const block = rawBlock as RecordBlock;
      if (typeof block.id !== "string" || typeof block.blockType !== "string") continue;
      flat.push(block);
      if (Array.isArray(block.childblocks)) visit(block.childblocks);
    }
  };
  visit(parsed);
  return flat;
}
