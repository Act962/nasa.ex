/**
 * Contexto de execução de Workflow no Modo Agente IA.
 *
 * Cada node lê e escreve num objeto `WorkflowContext` único por run.
 * Helpers aqui cobrem:
 *  - Interpolação de templates ("Olá {{lead.name}}, sua proposta de {{value}}")
 *  - Acesso por path ("lead.tags[0]" → "VIP")
 *  - Merge de outputs no contexto
 *  - Avaliação de condições simples (sem eval — segurança)
 */

export type WorkflowContext = {
  /** Lead que disparou (quando aplicável) */
  lead?: Record<string, unknown>;
  /** Snapshot do evento que disparou o trigger */
  trigger?: Record<string, unknown>;
  /** Variáveis criadas via SET_VARIABLE */
  vars: Record<string, unknown>;
  /** Output de cada node executado, indexado por nodeId */
  nodeOutputs: Record<string, unknown>;
  /** Item atual quando dentro de LOOP_OVER */
  loopItem?: unknown;
  /** Índice da iteração atual quando dentro de LOOP_OVER */
  loopIndex?: number;
};

export function createInitialContext(input: {
  lead?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  initialVars?: Record<string, unknown>;
}): WorkflowContext {
  return {
    lead: input.lead,
    trigger: input.trigger,
    vars: { ...(input.initialVars ?? {}) },
    nodeOutputs: {},
  };
}

/**
 * Lê valor por dot-path. Suporta arrays via [n] e dot notation.
 *   getByPath(ctx, "lead.name") → "João"
 *   getByPath(ctx, "lead.tags[0]") → "VIP"
 *   getByPath(ctx, "vars.foo.bar") → ctx.vars.foo.bar
 */
export function getByPath(
  ctx: WorkflowContext,
  path: string,
): unknown {
  if (!path) return undefined;
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = ctx;
  for (const seg of segments) {
    if (cur == null) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Interpolação de template: substitui `{{path}}` pelo valor do contexto.
 * Usa apenas dot-paths — não executa JS arbitrário (segurança).
 */
export function interpolate(
  ctx: WorkflowContext,
  template: string,
): string {
  if (!template) return template;
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawPath) => {
    const path = String(rawPath).trim();
    const val = getByPath(ctx, path);
    if (val == null) return "";
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }
    try {
      return JSON.stringify(val);
    } catch {
      return "";
    }
  });
}

/**
 * Mescla output do node no contexto. Output vai pra `nodeOutputs[nodeId]`,
 * e se for objeto com `vars` ou `lead`, esses campos sobem pro contexto raiz.
 */
export function mergeOutput(
  ctx: WorkflowContext,
  nodeId: string,
  output: unknown,
): WorkflowContext {
  const next: WorkflowContext = {
    ...ctx,
    nodeOutputs: { ...ctx.nodeOutputs, [nodeId]: output },
  };
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const o = output as Record<string, unknown>;
    if (o.vars && typeof o.vars === "object" && !Array.isArray(o.vars)) {
      next.vars = { ...ctx.vars, ...(o.vars as Record<string, unknown>) };
    }
    if (o.lead && typeof o.lead === "object" && !Array.isArray(o.lead)) {
      next.lead = { ...(ctx.lead ?? {}), ...(o.lead as Record<string, unknown>) };
    }
  }
  return next;
}

/**
 * Avaliador de condição simples — NÃO usa eval. Suporta operadores comuns
 * pro nó IF_CONDITION. Cada condição: `{ field: string, operator: string, value: unknown }`.
 *
 * Operadores: eq, neq, gt, gte, lt, lte, contains, in, not_in, exists, empty
 */
export type Condition = {
  field: string;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "in"
    | "not_in"
    | "exists"
    | "empty";
  value?: unknown;
};

export function evaluateCondition(
  ctx: WorkflowContext,
  cond: Condition,
): boolean {
  const fieldVal = getByPath(ctx, cond.field);
  switch (cond.operator) {
    case "eq":
      return fieldVal === cond.value;
    case "neq":
      return fieldVal !== cond.value;
    case "gt":
      return typeof fieldVal === "number" && typeof cond.value === "number"
        ? fieldVal > cond.value
        : false;
    case "gte":
      return typeof fieldVal === "number" && typeof cond.value === "number"
        ? fieldVal >= cond.value
        : false;
    case "lt":
      return typeof fieldVal === "number" && typeof cond.value === "number"
        ? fieldVal < cond.value
        : false;
    case "lte":
      return typeof fieldVal === "number" && typeof cond.value === "number"
        ? fieldVal <= cond.value
        : false;
    case "contains":
      if (typeof fieldVal === "string" && typeof cond.value === "string") {
        return fieldVal.toLowerCase().includes(cond.value.toLowerCase());
      }
      if (Array.isArray(fieldVal)) {
        return (fieldVal as unknown[]).includes(cond.value);
      }
      return false;
    case "in":
      return Array.isArray(cond.value)
        ? (cond.value as unknown[]).includes(fieldVal)
        : false;
    case "not_in":
      return Array.isArray(cond.value)
        ? !(cond.value as unknown[]).includes(fieldVal)
        : true;
    case "exists":
      return fieldVal !== undefined && fieldVal !== null;
    case "empty":
      if (fieldVal == null) return true;
      if (typeof fieldVal === "string") return fieldVal.trim() === "";
      if (Array.isArray(fieldVal)) return fieldVal.length === 0;
      return false;
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  ctx: WorkflowContext,
  conditions: Condition[],
  combinator: "AND" | "OR" = "AND",
): boolean {
  if (conditions.length === 0) return false;
  if (combinator === "OR") {
    return conditions.some((c) => evaluateCondition(ctx, c));
  }
  return conditions.every((c) => evaluateCondition(ctx, c));
}
