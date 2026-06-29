/**
 * Server-side: substitui placeholders `{{TYPE:slug:label}}` em `node.data`
 * pelos IDs reais da org de destino, dado um `RefMapping` (decisão do
 * user no dialog de import).
 *
 * Estratégia:
 *  - "reuse"  → coloca `targetId` no lugar
 *  - "create" → o caller (`importWorkflow`) já criou a entidade ANTES de
 *               chamar o resolver, e injetou o id criado no mapping como
 *               "reuse" pra simplificar — esta função só vê "reuse" + "skip"
 *  - "skip"   → mantém o ID original como placeholder vazio
 *               `{{TYPE_NOT_RESOLVED:slug}}`, que o executor já trata
 *               (vira `<<...>>` no formato compatível com o fix da PR #80).
 *
 * Aceita também o formato antigo `{{TAG:slug:label}}` usado pelos
 * presets agent-mode legados (backward compat — só pra TAG).
 */
import "server-only";
import { PLACEHOLDER_RX, type RefMapping, type RefType } from "./types";

const PLACEHOLDER_PREFIX_TO_REF_TYPE: Record<string, RefType> = {
  TAG: "tag",
  TAG_GROUP: "tag-group",
  STATUS: "status",
  COLUMN: "column",
  USER: "user",
  TRACKING: "tracking",
  FORM: "form",
  AGENDA: "agenda",
  FORGE_PRODUCT: "forge-product",
  FORGE_CONTRACT_TEMPLATE: "forge-contract-template",
  LINNKER_PAGE: "linnker-page",
  NBOX_FILE: "nbox-file",
  NASA_ROUTE_COURSE: "nasa-route-course",
  WORKFLOW: "workflow",
};

/**
 * Substitui placeholders recursivamente em qualquer valor JSON do node.
 * IDs sem decisão no mapping ficam intactos (tratados como skip).
 */
export function resolvePlaceholdersV2(
  value: unknown,
  mapping: RefMapping,
): unknown {
  if (typeof value === "string") {
    return value.replace(
      PLACEHOLDER_RX,
      (full, rawPrefix: string, slug: string) => {
        const refType = PLACEHOLDER_PREFIX_TO_REF_TYPE[rawPrefix];
        if (!refType) return full;
        const key = `${refType}:${slug}`;
        const decision = mapping[key];
        if (!decision) return full;
        if (decision.kind === "reuse") return decision.targetId;
        if (decision.kind === "skip") return `<<${rawPrefix}_NOT_RESOLVED:${slug}>>`;
        // "create" — não deveria chegar aqui (caller já cria antes
        // de chamar o resolver). Mantém placeholder pra debug.
        return full;
      },
    );
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolvePlaceholdersV2(v, mapping));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolvePlaceholdersV2(v, mapping);
    }
    return out;
  }
  return value;
}
