/**
 * Tipos centrais do clipboard de workflows.
 *
 * BlueprintV2 = formato portável de workflow (ou subset de nodes) com refs
 * substituídas por **placeholders semânticos** `{{TYPE:slug:label}}`. Pode
 * ser exportado pro browser clipboard / arquivo / banco e importado em
 * qualquer org/tracking depois.
 *
 * Diferenças vs `Blueprint` v1 (em `agent-presets/create-from-blueprint.ts`):
 *  - Suporta múltiplos tipos de placeholder (não só TAG).
 *  - Carrega `refs` declaradas separadamente (lista do que precisa ser
 *    mapeado) — UI usa pra construir o dialog de mapping.
 *  - Tem metadata (sourceOrgName, sourceTrackingName, exportedAt, formatVersion)
 *    pra debug + UX no import.
 */

/**
 * Tipos de entidade que podem ser referenciadas em node.data.
 *
 * Categorias:
 *  - "scoped-org"     → recurso compartilhado da org (TAG, TAG_GROUP, USER, NASA_ROUTE_COURSE…)
 *                       Auto-resolve fuzzy + criar é seguro.
 *  - "scoped-tracking" → vive sob tracking (STATUS, COLUMN). Auto-resolve fuzzy.
 *  - "scoped-org-heavy" → editor pesado e não pode ser auto-criado
 *                         (FORM, AGENDA, FORGE_*, LINNKER_PAGE, NBOX_FILE…).
 *                         Mapping manual obrigatório.
 *  - "external"        → recurso que muda entre orgs (TRACKING destino do MOVE_LEAD).
 *                        Mapping manual obrigatório.
 */
export const REF_TYPES = [
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
] as const;

export type RefType = (typeof REF_TYPES)[number];

/** Categoria de comportamento de cada RefType — guia a UI de mapping. */
export type RefBehavior = "auto-createable" | "auto-suggestable" | "manual-only";

/**
 * Comportamento default por tipo. UI pode reescrever:
 *  - "auto-createable": tem fuzzy match + botão "criar nova" no dialog
 *  - "auto-suggestable": tem fuzzy match mas sem criar (precisa mapear pra existente)
 *  - "manual-only": sem fuzzy — user escolhe explicitamente
 */
export const REF_BEHAVIOR: Record<RefType, RefBehavior> = {
  tag: "auto-createable",
  "tag-group": "auto-createable",
  status: "auto-createable",
  column: "auto-createable",
  user: "manual-only", // user não duplica entre orgs
  tracking: "manual-only",
  form: "auto-suggestable",
  agenda: "auto-suggestable",
  "forge-product": "auto-suggestable",
  "forge-contract-template": "auto-suggestable",
  "linnker-page": "auto-suggestable",
  "nbox-file": "auto-suggestable",
  "nasa-route-course": "auto-suggestable",
  workflow: "manual-only",
};

/**
 * Uma referência descoberta pelo serializer. Carrega TUDO que o resolver
 * precisa pra encontrar a entidade-alvo na org de destino + sugestões
 * automáticas.
 */
export interface BlueprintRef {
  type: RefType;
  /** Slug semântico (estável). Pra TAG vem do `tag.slug` quando existe. */
  slug: string;
  /** Nome legível pro humano — mostrado no dialog de mapping. */
  label: string;
  /** Hex color quando aplicável (tag, tag-group). */
  color?: string | null;
  /**
   * ID original na org de origem. NÃO é portado pro destino — só serve
   * pra UI mostrar "antes era X" e pra dedup quando o mesmo ID aparece em
   * vários nodes.
   */
  originalId?: string;
  /** Subtipo livre — ex: `TagType.GROUP` ou `Status.kind`. */
  meta?: Record<string, unknown>;
}

/**
 * Um placeholder do nó. Formato canônico:
 *   `{{TAG:slug-da-tag:Label Humano}}`
 *
 * O label é descartável (só ajuda LLM/humano). O parser só usa type+slug.
 * Slug usa kebab-case, [a-z0-9-]. Label é livre exceto `}` e `:`.
 */
export const PLACEHOLDER_RX =
  /\{\{(TAG|TAG_GROUP|STATUS|COLUMN|USER|TRACKING|FORM|AGENDA|FORGE_PRODUCT|FORGE_CONTRACT_TEMPLATE|LINNKER_PAGE|NBOX_FILE|NASA_ROUTE_COURSE|WORKFLOW):([a-z0-9-]+)(?::([^}]+))?\}\}/g;

/**
 * BlueprintNode portável — `data` pode conter placeholders nos campos
 * referenciais. Posições são preservadas (importar nó-a-nó manténs
 * layout).
 */
export interface BlueprintV2Node {
  /** Cuid local do blueprint — usado pra resolver edges. NÃO vai pro banco. */
  id: string;
  /** NodeType do enum Prisma. String pra evitar dependência circular. */
  type: string;
  position: { x: number; y: number };
  /** name opcional — default = type. */
  name?: string;
  /** data com placeholders já injetados. */
  data: Record<string, unknown>;
}

export interface BlueprintV2Edge {
  fromNodeId: string;
  toNodeId: string;
  fromOutput?: string;
  toInput?: string;
}

/**
 * Container completo do clipboard. Versionado pra futura evolução do
 * formato (formatVersion bump → migração no import).
 */
export interface BlueprintV2 {
  /** Versão do formato — bump quando muda estrutura. */
  formatVersion: 1;
  /** Tipo de export — workflow completo ou seleção parcial de nodes. */
  kind: "full-workflow" | "node-selection";
  /** Workflow metadata (só pra full-workflow — preservado no import). */
  workflow?: {
    name: string;
    description?: string | null;
    agentMode: boolean;
    maxRunsPerHour?: number | null;
  };
  /** Metadata de auditoria — útil pro user entender origem. */
  source: {
    /** Org de origem (informativo). */
    organizationName?: string;
    /** Tracking de origem (informativo). */
    trackingName?: string;
    /** Workflow original (informativo). */
    workflowName?: string;
    /** Timestamp ISO de quando o export foi gerado. */
    exportedAt: string;
    /** Versão do app que gerou o export. */
    appVersion?: string;
  };
  nodes: BlueprintV2Node[];
  edges: BlueprintV2Edge[];
  /**
   * Lista única de refs presentes nos nodes. UI usa pra montar o dialog
   * de mapping (1 linha por ref). Resolver lookup por (type, slug).
   */
  refs: BlueprintRef[];
}

/**
 * Decisão do user no dialog de mapping pra uma ref específica.
 */
export type RefMappingDecision =
  /** Reusa entidade existente no destino (id real). */
  | { kind: "reuse"; targetId: string }
  /** Cria entidade nova com os dados do blueprint (slug/name/color). */
  | { kind: "create" }
  /** Skipa — placeholder fica literal, nó pode quebrar (UI avisa). */
  | { kind: "skip" };

/**
 * Mapping completo do import. Chave = `${type}:${slug}` (mesmo que aparece
 * no placeholder).
 */
export type RefMapping = Record<string, RefMappingDecision>;

/**
 * Resultado do `previewImport` — quanto auto-resolve, quanto precisa de
 * decisão manual, sugestões pra cada ref.
 */
export interface ImportPreview {
  refs: Array<{
    ref: BlueprintRef;
    /**
     * Sugestão automática quando há match fuzzy >= 0.7.
     * UI pré-seleciona "reuse" com esse id; user pode mudar.
     */
    autoMatch?: {
      targetId: string;
      targetLabel: string;
      score: number;
      matchedBy: "slug" | "name";
    } | null;
    /** Outras opções de match (top 3) — pro user trocar fácil. */
    alternatives: Array<{ id: string; label: string; score: number }>;
    behavior: RefBehavior;
  }>;
  /** Resumo agregado pra UI mostrar "X auto-resolved, Y precisam decisão". */
  summary: {
    total: number;
    autoResolved: number;
    needsManual: number;
    canCreate: number;
  };
}
