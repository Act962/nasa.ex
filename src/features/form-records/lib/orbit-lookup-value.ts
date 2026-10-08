// Valor do bloco "Busca no Órbita" (spec 0075, RF-7).

export const ORBIT_LOOKUP_KIND = "orbit-lookup";
export const ORBIT_LOOKUP_BLOCK_TYPE = "OrbitLookup";

/** LEADS, RECORDS e PRODUCTS buscam no servidor; INLINE é a lista do próprio campo. */
export const LOOKUP_SOURCES = ["LEADS", "RECORDS", "PRODUCTS"] as const;
export type ServerLookupSource = (typeof LOOKUP_SOURCES)[number];
export type LookupSource = ServerLookupSource | "INLINE";

export interface OrbitLookupMeta {
  kind: typeof ORBIT_LOOKUP_KIND;
  version: 1;
  source: LookupSource;
  /** Id do registro escolhido; `null` quando o texto foi digitado à mão. */
  refId: string | null;
}

export function buildOrbitLookupValue(params: {
  text: string;
  source: LookupSource;
  refId: string | null;
}): { value: string; meta?: Record<string, unknown> } {
  const text = params.text.trim();
  if (!text) return { value: "" };
  const meta: OrbitLookupMeta = { kind: ORBIT_LOOKUP_KIND, version: 1, source: params.source, refId: params.refId };
  return { value: text, meta: meta as unknown as Record<string, unknown> };
}

export function parseOrbitLookupMeta(meta: Record<string, unknown> | undefined): OrbitLookupMeta | null {
  if (!meta || meta.kind !== ORBIT_LOOKUP_KIND) return null;
  return meta as unknown as OrbitLookupMeta;
}

/** "Fiat Argo\nFiat Mobi" ou colado do Excel → itens únicos, sem linhas vazias. */
export function parseInlineOptions(rawText: string, maxItems = 2000): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of rawText.split(/\r?\n|\t|;/)) {
    const item = line.trim();
    const dedupeKey = item.toLowerCase();
    if (!item || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push(item);
    if (items.length >= maxItems) break;
  }
  return items;
}

/** Filtro da lista do próprio campo: sem acento, por pedaços da busca. */
export function filterInlineOptions(options: string[], query: string, maxResults = 8): string[] {
  const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return options.slice(0, maxResults);
  return options.filter((option) => terms.every((term) => normalize(option).includes(term))).slice(0, maxResults);
}
