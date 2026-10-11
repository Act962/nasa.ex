import type { FlowDiagnosticsIndex, FlowEdgeInput, FlowNodeInput } from "@/features/workflows/lib/flow-diagnostics";

// Caminho da navezinha: uma só no fluxo inteiro, passando pelas ligações na ordem em que o fluxo
// corre a partir dos gatilhos. Trecho com problema fica de fora, porque não roda.

export interface SparkSlot {
  index: number;
  total: number;
  /** Muda quando o caminho muda: todas as ligações recomeçam a animação juntas e ficam no mesmo relógio. */
  routeVersion: number;
}

export type SparkRoute = Record<string, SparkSlot>;

export function orderSparkRoute(
  nodes: FlowNodeInput[],
  edges: FlowEdgeInput[],
  diagnostics: FlowDiagnosticsIndex,
  routeVersion: number,
): SparkRoute {
  const outgoing = new Map<string, FlowEdgeInput[]>();
  const nodesWithIncoming = new Set<string>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    nodesWithIncoming.add(edge.target);
  }
  const isRunnable = (nodeId: string) => !diagnostics.byNode[nodeId] && !diagnostics.blockedNodeIds[nodeId];

  const orderedEdgeIds: string[] = [];
  const visitedNodeIds = new Set<string>();
  const visit = (nodeId: string) => {
    if (visitedNodeIds.has(nodeId) || !isRunnable(nodeId)) return;
    visitedNodeIds.add(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      orderedEdgeIds.push(edge.id);
      visit(edge.target);
    }
  };
  for (const node of nodes) if (!nodesWithIncoming.has(node.id)) visit(node.id);

  return Object.fromEntries(orderedEdgeIds.map((edgeId, index) => [edgeId, { index, total: orderedEdgeIds.length, routeVersion }]));
}

const HIDE_GAP = 0.01;

/**
 * Quadros-chave da nave numa ligação: ela só aparece na vez desta ligação, na ida e na volta,
 * e fica escondida enquanto percorre as outras.
 */
export function sparkKeyframes(animationName: string, slot: Pick<SparkSlot, "index" | "total">): string {
  const slotShare = 100 / (2 * slot.total);
  const forwardStart = slot.index * slotShare;
  const forwardEnd = forwardStart + slotShare;
  const backStart = (2 * slot.total - 1 - slot.index) * slotShare;
  const backEnd = backStart + slotShare;
  const frames: string[] = [];
  const frame = (percent: number, distance: number, opacity: number, rotate: "auto" | "reverse") =>
    frames.push(`${Math.min(100, Math.max(0, percent)).toFixed(3)}% { offset-distance: ${distance}%; opacity: ${opacity}; offset-rotate: ${rotate}; }`);

  if (forwardStart > 0) {
    frame(0, 0, 0, "auto");
    frame(forwardStart - HIDE_GAP, 0, 0, "auto");
  }
  frame(forwardStart, 0, 1, "auto");
  frame(forwardEnd, 100, 1, "auto");
  if (backStart > forwardEnd) {
    frame(forwardEnd + HIDE_GAP, 100, 0, "reverse");
    frame(backStart - HIDE_GAP, 100, 0, "reverse");
    frame(backStart, 100, 1, "reverse");
  } else {
    frame(forwardEnd + HIDE_GAP, 100, 1, "reverse");
  }
  frame(backEnd, 0, 1, "reverse");
  if (backEnd < 100) {
    frame(backEnd + HIDE_GAP, 0, 0, "reverse");
    frame(100, 0, 0, "reverse");
  }
  return `@keyframes ${animationName} { ${frames.join(" ")} }`;
}
