/**
 * Dicionário central: quais campos em `node.data` referenciam quais
 * entidades, por NodeType.
 *
 * Fonte de verdade pro:
 *  - `ref-extractor.ts` — escaneia data → coleta IDs reais p/ lookup de labels
 *  - `ref-injector.ts` — substitui IDs por placeholders `{{TYPE:slug:label}}`
 *  - `ref-resolver.ts` — caminho inverso no import (placeholder → id real)
 *
 * Cada entrada descreve UM campo:
 *  - `path` é uma lista de keys/wildcards aplicada recursivamente. `*` significa
 *    "todos os elementos do array nesta posição".
 *  - `refType` indica a entidade-alvo (do enum em `types.ts`).
 *  - `isArray: true` indica que o valor final é `string[]` (ex: TAG.tagsIds).
 *
 * Adicione novos campos aqui ao introduzir NodeType novo. NÃO precisa
 * tocar nos extractors/injectors — eles são driven por este catálogo.
 */
import type { RefType } from "./types";

export interface RefFieldDescriptor {
  /** Caminho dentro de `node.data`. Ex: ["action", "tagsIds"]. Use "*" pra elemento de array. */
  path: string[];
  refType: RefType;
  /** true = string[]; false = string única. */
  isArray: boolean;
}

/**
 * Catálogo principal. Cobre os campos achados via análise dos dialogs +
 * `validate-node.ts` + presets agent-mode.
 *
 * NodeTypes sem refs (NEW_LEAD, AI_DECISION, HTTP_REQUEST, SEND_MESSAGE…)
 * podem ser omitidos — o extractor só visita os tipos listados aqui.
 */
export const NODE_REF_CATALOG: Record<string, RefFieldDescriptor[]> = {
  // ── Triggers ─────────────────────────────────────────────────────
  LEAD_TAGGED: [
    // tagIds flat (formato antigo) ou aninhado em conditions[]
    { path: ["action", "tagIds"], refType: "tag", isArray: true },
    { path: ["action", "conditions", "*", "tagIds"], refType: "tag", isArray: true },
    { path: ["tagIds"], refType: "tag", isArray: true },
    { path: ["conditions", "*", "tagIds"], refType: "tag", isArray: true },
  ],
  MOVE_LEAD_STATUS: [
    // como trigger: data.statusId; como action: data.action.statusId
    { path: ["statusId"], refType: "status", isArray: false },
    { path: ["fromStatusId"], refType: "status", isArray: false },
    { path: ["toStatusId"], refType: "status", isArray: false },
    { path: ["action", "statusId"], refType: "status", isArray: false },
    { path: ["action", "fromStatusId"], refType: "status", isArray: false },
    { path: ["action", "toStatusId"], refType: "status", isArray: false },
  ],

  // ── Actions simples ──────────────────────────────────────────────
  TAG: [
    { path: ["action", "tagsIds"], refType: "tag", isArray: true },
    // alguns blueprints antigos usam plural correto:
    { path: ["action", "tagIds"], refType: "tag", isArray: true },
  ],
  MOVE_LEAD: [
    { path: ["trackingId"], refType: "tracking", isArray: false },
    { path: ["statusId"], refType: "status", isArray: false },
    { path: ["action", "trackingId"], refType: "tracking", isArray: false },
    { path: ["action", "statusId"], refType: "status", isArray: false },
  ],
  RESPONSIBLE: [
    { path: ["action", "userId"], refType: "user", isArray: false },
    { path: ["action", "responsibleId"], refType: "user", isArray: false },
  ],

  // ── Apps NASA — flat (data.*) ────────────────────────────────────
  SEND_FORM: [{ path: ["formId"], refType: "form", isArray: false }],
  OPEN_FORM: [{ path: ["formId"], refType: "form", isArray: false }],
  SEND_AGENDA: [{ path: ["agendaId"], refType: "agenda", isArray: false }],

  // ── Apps NASA — action.* ─────────────────────────────────────────
  SEND_PROPOSAL: [
    {
      path: ["action", "productIds"],
      refType: "forge-product",
      isArray: true,
    },
    { path: ["action", "responsibleId"], refType: "user", isArray: false },
  ],
  SEND_CONTRACT: [
    {
      path: ["action", "templateContractId"],
      refType: "forge-contract-template",
      isArray: false,
    },
  ],
  SEND_LINNKER: [
    {
      path: ["action", "linnkerPageId"],
      refType: "linnker-page",
      isArray: false,
    },
  ],
  SEND_NBOX: [
    { path: ["action", "nboxItemId"], refType: "nbox-file", isArray: false },
  ],
  SEND_NASA_ROUTE: [
    {
      path: ["action", "courseId"],
      refType: "nasa-route-course",
      isArray: false,
    },
  ],

  // ── Workflow loop ────────────────────────────────────────────────
  CALL_WORKFLOW: [
    { path: ["action", "workflowId"], refType: "workflow", isArray: false },
  ],
};

/**
 * Filename do clipboard quando o user faz download.
 * Slug do workflow + timestamp.
 */
export function clipboardFileName(workflowName: string, timestamp: Date): string {
  const slug = workflowName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const yyyymmdd = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
  return `nasa-workflow-${slug || "export"}-${yyyymmdd}.json`;
}
