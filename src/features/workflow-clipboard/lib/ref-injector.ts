/**
 * Substitui IDs reais por placeholders semânticos `{{TYPE:slug:label}}`
 * dentro de `node.data`, dado um `lookup` `{ [refType]: { [id]: BlueprintRef } }`.
 *
 * Trabalha em CLONE do data — não muta o objeto recebido.
 *
 * Caminho oposto (placeholder → ID) está no `ref-resolver.ts`, server-side.
 */
import {
  NODE_REF_CATALOG,
  type RefFieldDescriptor,
} from "./ref-catalog";
import type { BlueprintRef, RefType } from "./types";

/**
 * Lookup populado pelo serializer após buscar labels no DB:
 *   lookup.tag[idReal] = { slug, label, color, originalId }
 */
export type RefLookup = Partial<Record<RefType, Record<string, BlueprintRef>>>;

const REF_TYPE_TO_PLACEHOLDER_PREFIX: Record<RefType, string> = {
  tag: "TAG",
  "tag-group": "TAG_GROUP",
  status: "STATUS",
  column: "COLUMN",
  user: "USER",
  tracking: "TRACKING",
  form: "FORM",
  agenda: "AGENDA",
  "forge-product": "FORGE_PRODUCT",
  "forge-contract-template": "FORGE_CONTRACT_TEMPLATE",
  "linnker-page": "LINNKER_PAGE",
  "nbox-file": "NBOX_FILE",
  "nasa-route-course": "NASA_ROUTE_COURSE",
  workflow: "WORKFLOW",
};

/** Sanitiza label pra caber dentro do placeholder (não pode ter `:` nem `}`). */
function escapeLabel(label: string): string {
  return label.replace(/[:}]/g, "·").slice(0, 60);
}

function makePlaceholder(ref: BlueprintRef, refType: RefType): string {
  const prefix = REF_TYPE_TO_PLACEHOLDER_PREFIX[refType];
  const label = escapeLabel(ref.label || ref.slug);
  return `{{${prefix}:${ref.slug}:${label}}}`;
}

/**
 * Aplica os placeholders num node.data, retornando o novo objeto.
 * Se um ID não tem entrada no lookup, MANTÉM o ID original — significa
 * que o serializer não conseguiu resolver (entidade deletada, sem
 * permissão, etc). O importador trata como ID inválido.
 */
export function injectPlaceholders(
  nodeType: string,
  data: Record<string, unknown>,
  lookup: RefLookup,
): Record<string, unknown> {
  const descriptors = NODE_REF_CATALOG[nodeType];
  if (!descriptors || descriptors.length === 0) {
    // Clone defensivo mesmo sem refs — caller pode mutar depois.
    return structuredClone(data);
  }

  const cloned = structuredClone(data);
  for (const desc of descriptors) {
    rewritePath(cloned, desc.path, (value) => transform(value, desc, lookup));
  }
  return cloned;
}

function transform(
  value: unknown,
  desc: RefFieldDescriptor,
  lookup: RefLookup,
): unknown {
  const typeLookup = lookup[desc.refType] ?? {};
  if (desc.isArray) {
    if (!Array.isArray(value)) return value;
    return value.map((id) => {
      if (typeof id !== "string") return id;
      const ref = typeLookup[id];
      return ref ? makePlaceholder(ref, desc.refType) : id;
    });
  }
  // single string
  if (typeof value !== "string") return value;
  const ref = typeLookup[value];
  return ref ? makePlaceholder(ref, desc.refType) : value;
}

/**
 * Walk o path dentro de `data` e aplica `fn` no valor terminal.
 * Suporta wildcard `*` (itera array). Muta `data` in-place.
 */
function rewritePath(
  data: unknown,
  path: string[],
  fn: (value: unknown) => unknown,
): void {
  if (path.length === 0 || data == null || typeof data !== "object") return;

  const [head, ...rest] = path;

  if (head === "*") {
    if (!Array.isArray(data)) return;
    for (const item of data) rewritePath(item, rest, fn);
    return;
  }

  const obj = data as Record<string, unknown>;
  if (rest.length === 0) {
    if (head in obj) {
      obj[head] = fn(obj[head]);
    }
    return;
  }
  rewritePath(obj[head], rest, fn);
}
