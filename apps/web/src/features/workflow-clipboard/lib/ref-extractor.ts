/**
 * Lê `node.data` de cada nó e coleta TODAS as referências (IDs reais) que
 * apontam pra outras entidades, baseado no `NODE_REF_CATALOG`.
 *
 * Output:
 *  - `byType[refType]` = Set<string> de IDs únicos achados (pra batch lookup)
 *  - `perNode[nodeId]` = array de { descriptor, valueAtPath } pra reescrita
 *
 * Pode rodar sem prisma — só visita JSON. Lookups de label vêm depois no
 * `serialize.ts`.
 */
import { NODE_REF_CATALOG, type RefFieldDescriptor } from "./ref-catalog";
import type { RefType } from "./types";

export interface ExtractedNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ExtractedRefHit {
  /** Descriptor que matched. */
  descriptor: RefFieldDescriptor;
  /** Valor literal achado no path (string ou string[]). */
  ids: string[];
}

export interface ExtractResult {
  /** IDs únicos por tipo — usa pra batch fetch de labels. */
  byType: Record<RefType, Set<string>>;
  /** Detalhe por nó — usa pra reescrita no injector. */
  perNode: Record<string, ExtractedRefHit[]>;
}

const ALL_REF_TYPES: RefType[] = [
  "tag",
  "tag-group",
  "status",
  "column",
  "user",
  "tracking",
  "form",
  "agenda",
  "forge-product",
  "forge-contract-template",
  "linnker-page",
  "nbox-file",
  "nasa-route-course",
  "workflow",
];

export function extractRefs(nodes: ExtractedNode[]): ExtractResult {
  const byType = Object.fromEntries(
    ALL_REF_TYPES.map((t) => [t, new Set<string>()]),
  ) as Record<RefType, Set<string>>;
  const perNode: Record<string, ExtractedRefHit[]> = {};

  for (const node of nodes) {
    const descriptors = NODE_REF_CATALOG[node.type];
    if (!descriptors || descriptors.length === 0) continue;
    perNode[node.id] = [];

    for (const desc of descriptors) {
      const found = readPath(node.data, desc.path);
      // found pode ser string | string[] | null
      const ids = found
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        // Skipa placeholders <<...>> e {{...}} — não são IDs reais.
        .filter((v) => !/^<<.+>>$/.test(v) && !/^\{\{.+\}\}$/.test(v));
      if (ids.length === 0) continue;
      perNode[node.id].push({ descriptor: desc, ids });
      for (const id of ids) byType[desc.refType].add(id);
    }
  }

  return { byType, perNode };
}

/**
 * Lê todos os valores no path dentro de `data`. Suporta wildcard `*` pra
 * iterar arrays. Retorna lista flat de strings (ou outros tipos — caller
 * filtra).
 */
function readPath(data: unknown, path: string[]): unknown[] {
  if (path.length === 0) return [data];
  const [head, ...rest] = path;
  if (data == null || typeof data !== "object") return [];

  if (head === "*") {
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => readPath(item, rest));
  }

  const next = (data as Record<string, unknown>)[head];
  if (next === undefined) return [];

  // Se o próximo path está vazio e o valor é array, expande
  if (rest.length === 0 && Array.isArray(next)) {
    return next;
  }
  return readPath(next, rest);
}
