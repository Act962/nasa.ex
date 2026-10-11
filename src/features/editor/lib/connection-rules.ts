// O que pode ser ligado no desenho do fluxo. Vale para soltar a ligação no pontinho, no corpo do
// quadro e para o aviso visual enquanto a pessoa arrasta.

interface RuleNode {
  id: string;
  type?: string | null;
}

interface RuleEdge {
  id: string;
  source: string;
  target: string;
}

/** Quadros de repetição voltam para trás de propósito: o círculo ali é o próprio recurso. */
const LOOP_NODE_TYPES = new Set(["LOOP_OVER"]);

export type ConnectionRefusal = "same-node" | "into-trigger" | "closes-a-circle";

export function refuseConnection(params: {
  sourceId: string;
  targetId: string;
  nodes: RuleNode[];
  edges: RuleEdge[];
  triggerTypes: Set<string>;
  /** Ligação que está sendo religada: sai da conta, porque vai deixar de existir como está. */
  ignoreEdgeId?: string;
}): ConnectionRefusal | null {
  const { sourceId, targetId, nodes, edges, triggerTypes, ignoreEdgeId } = params;
  if (sourceId === targetId) return "same-node";
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (triggerTypes.has(String(nodeById.get(targetId)?.type ?? ""))) return "into-trigger";
  if (LOOP_NODE_TYPES.has(String(nodeById.get(sourceId)?.type ?? "")) || LOOP_NODE_TYPES.has(String(nodeById.get(targetId)?.type ?? ""))) {
    return null;
  }

  // Fecha um círculo se, saindo do destino, já dá para chegar na origem.
  const targetsBySource = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.id === ignoreEdgeId) continue;
    targetsBySource.set(edge.source, [...(targetsBySource.get(edge.source) ?? []), edge.target]);
  }
  const pending = [targetId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (nodeId === sourceId) return "closes-a-circle";
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    pending.push(...(targetsBySource.get(nodeId) ?? []));
  }
  return null;
}

export const REFUSAL_MESSAGES: Record<ConnectionRefusal, string> = {
  "same-node": "Um passo não pode ser ligado nele mesmo.",
  "into-trigger": "O gatilho é o começo do fluxo: nada pode ser ligado na entrada dele.",
  "closes-a-circle": "Essa ligação faria o fluxo andar em círculo, sem fim.",
};
