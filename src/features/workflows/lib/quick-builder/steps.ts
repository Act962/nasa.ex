// Construtor rápido (spec 0039): passos lineares ↔ blueprint do canvas, e a
// chave que identifica "a mesma lógica" para o alerta de duplicação. Puro.

export interface QuickStep {
  type: string;
  data: Record<string, unknown>;
  name?: string;
}

export interface QuickBlueprintNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  name?: string;
}

export interface QuickBlueprintEdge {
  fromNodeId: string;
  toNodeId: string;
  fromOutput?: string;
  toInput?: string;
}

const COLUMN_WIDTH = 320;

/** Passos em linha → nós e ligações `main` em sequência, como o canvas espera. */
export function stepsToBlueprint(name: string, steps: QuickStep[]) {
  const nodes: QuickBlueprintNode[] = steps.map((step, index) => ({
    id: `step-${index + 1}`,
    type: step.type,
    position: { x: index * COLUMN_WIDTH, y: 0 },
    data: step.data,
    ...(step.name ? { name: step.name } : {}),
  }));
  const edges: QuickBlueprintEdge[] = nodes.slice(1).map((node, index) => ({
    fromNodeId: nodes[index].id,
    toNodeId: node.id,
    fromOutput: "main",
    toInput: "main",
  }));
  return { name, nodes, edges };
}

/**
 * Blueprint gerado por frase → passos, se for uma linha reta a partir do
 * gatilho. Com ramificação (Se/Senão, Decisão da IA…), `isLinear = false`:
 * esse fluxo só cabe no modo avançado.
 */
export function blueprintToSteps(nodes: QuickBlueprintNode[], edges: QuickBlueprintEdge[]) {
  const incoming = new Set(edges.map((edge) => edge.toNodeId));
  const start = nodes.find((node) => !incoming.has(node.id)) ?? nodes[0];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const steps: QuickStep[] = [];
  let isLinear = true;
  const visited = new Set<string>();
  let current: QuickBlueprintNode | undefined = start;
  while (current && !visited.has(current.id)) {
    const node: QuickBlueprintNode = current;
    visited.add(node.id);
    steps.push({ type: node.type, data: node.data, ...(node.name ? { name: node.name } : {}) });
    const outgoing = edges.filter((edge) => edge.fromNodeId === node.id);
    if (outgoing.length > 1 || outgoing.some((edge) => (edge.fromOutput ?? "main") !== "main")) isLinear = false;
    current = outgoing[0] ? nodeById.get(outgoing[0].toNodeId) : undefined;
  }
  if (visited.size !== nodes.length) isLinear = false;
  return { steps, isLinear };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** O que torna dois gatilhos "o mesmo": tipo + a configuração que decide quando dispara. */
export function triggerKey(step: QuickStep): string {
  const action = readRecord(step.data.action);
  if (step.type === "LEAD_TAGGED") {
    const tagIds = Array.isArray(action.tagIds) ? (action.tagIds as string[]) : [];
    return `${step.type}:${[...tagIds].sort().join(",")}`;
  }
  if (step.type === "MOVE_LEAD_STATUS") return `${step.type}:${String(action.statusId ?? "")}`;
  if (step.type === "SCHEDULE_TRIGGER") {
    const schedule = readRecord(step.data.schedule);
    const weekdays = Array.isArray(schedule.weekdays) ? [...(schedule.weekdays as number[])].sort().join(",") : "";
    return `${step.type}:${schedule.frequency}:${schedule.time}:${weekdays}:${schedule.date ?? ""}`;
  }
  return step.type;
}

/** Nós que só existem como gatilho. */
export const QUICK_TRIGGER_TYPES = new Set([
  "MANUAL_TRIGGER",
  "NEW_LEAD",
  "MOVE_LEAD_STATUS",
  "LEAD_TAGGED",
  "AI_FINISHED",
  "FIRST_CHAT_INTERACTION",
  "FIRST_INTERACTION_OF_DAY",
  "LAST_INBOUND_TIMEOUT",
  "PAYMENT_RECEIVED",
  "MESSAGE_INCOMING",
  "WEBHOOK_EXTERNAL",
  "SCHEDULE_TRIGGER",
  "INITIAL",
]);
