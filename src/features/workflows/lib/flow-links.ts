// Ligação entre fluxos (spec 0092, etapa 2): "terminou um, roda o outro". É um passo
// "Chamar sub-fluxo" em modo passagem (`mode: "handoff"`) no fim do fluxo de origem.
// Sem `server-only`: o mapa usa as mesmas regras para desenhar e para avisar antes de ligar.

export const HANDOFF_MODE = "handoff";
export const MAX_HANDOFF_DEPTH = 5;

export interface LinkableFlow {
  id: string;
  agentMode?: boolean;
  nodes: { id: string; type: string; data: unknown }[];
}

export interface FlowLink {
  fromWorkflowId: string;
  toWorkflowId: string;
  /** Passo "Chamar sub-fluxo" que faz a ligação. */
  nodeId: string;
}

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** Destino de um passo "Chamar sub-fluxo" em modo passagem. `null` para os demais passos. */
export function handoffTarget(node: { type: string; data: unknown }): string | null {
  if (node.type !== "CALL_WORKFLOW") return null;
  const data = asFields(node.data);
  return data.mode === HANDOFF_MODE && typeof data.workflowId === "string" && data.workflowId ? data.workflowId : null;
}

export function listFlowLinks(flows: LinkableFlow[]): FlowLink[] {
  const knownIds = new Set(flows.map((flow) => flow.id));
  return flows.flatMap((flow) =>
    flow.nodes.flatMap((node) => {
      const toWorkflowId = handoffTarget(node);
      return toWorkflowId && knownIds.has(toWorkflowId) ? [{ fromWorkflowId: flow.id, toWorkflowId, nodeId: node.id }] : [];
    }),
  );
}

export type LinkRefusal = "same-flow" | "needs-agent-mode" | "already-linked" | "closes-a-circle" | "too-deep" | "unknown-flow";

export const LINK_REFUSAL_MESSAGES: Record<LinkRefusal, string> = {
  "same-flow": "Um fluxo não pode seguir para ele mesmo.",
  "needs-agent-mode": "Só dá para ligar fluxos que estão no Modo Agente IA. Ligue o modo nos dois fluxos antes.",
  "already-linked": "Esses dois fluxos já estão ligados.",
  "closes-a-circle": "Essa ligação faria os fluxos andarem em círculo, sem fim.",
  "too-deep": `Uma sequência de fluxos pode ter no máximo ${MAX_HANDOFF_DEPTH} passagens.`,
  "unknown-flow": "Não achei um dos fluxos neste funil.",
};

/** Maior número de passagens seguidas a partir de um fluxo. O grafo não tem círculo (a regra abaixo garante). */
function longestChain(startId: string, targetsBySource: Map<string, string[]>, visiting = new Set<string>()): number {
  if (visiting.has(startId)) return 0;
  visiting.add(startId);
  const longest = Math.max(0, ...(targetsBySource.get(startId) ?? []).map((nextId) => 1 + longestChain(nextId, targetsBySource, visiting)));
  visiting.delete(startId);
  return longest;
}

export function refuseFlowLink(params: { flows: LinkableFlow[]; fromWorkflowId: string; toWorkflowId: string }): LinkRefusal | null {
  const { flows, fromWorkflowId, toWorkflowId } = params;
  if (fromWorkflowId === toWorkflowId) return "same-flow";
  const source = flows.find((flow) => flow.id === fromWorkflowId);
  const target = flows.find((flow) => flow.id === toWorkflowId);
  if (!source || !target) return "unknown-flow";
  if (!source.agentMode || !target.agentMode) return "needs-agent-mode";

  const links = listFlowLinks(flows);
  if (links.some((link) => link.fromWorkflowId === fromWorkflowId && link.toWorkflowId === toWorkflowId)) return "already-linked";

  const targetsBySource = new Map<string, string[]>();
  for (const link of [...links, { fromWorkflowId, toWorkflowId }]) {
    targetsBySource.set(link.fromWorkflowId, [...(targetsBySource.get(link.fromWorkflowId) ?? []), link.toWorkflowId]);
  }
  // Fecha círculo se, saindo do destino, dá para voltar à origem.
  const pending = [toWorkflowId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const flowId = pending.pop()!;
    if (flowId === fromWorkflowId) return "closes-a-circle";
    if (visited.has(flowId)) continue;
    visited.add(flowId);
    pending.push(...(targetsBySource.get(flowId) ?? []));
  }
  const hasTooLongChain = flows.some((flow) => longestChain(flow.id, targetsBySource) > MAX_HANDOFF_DEPTH);
  return hasTooLongChain ? "too-deep" : null;
}
