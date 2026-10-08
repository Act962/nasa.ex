import type { Edge, Node } from "@xyflow/react";
import { BRANCH_COLORS } from "./map-graph";

/** Leituras tipadas de `node.data` (que o React Flow guarda como registro livre) e posição do nó na árvore. */

const readString = (value: unknown) => (typeof value === "string" ? value : undefined);

export function readNodeColor(node: Node | undefined) {
  return readString(node?.data.color);
}

/** Texto do nó: tópicos e notas usam `label`; cards usam `title`. */
export function readNodeText(node: Node) {
  return readString(node.data.label) ?? readString(node.data.title) ?? "";
}

/** O banco guarda o grafo como JSON livre; aqui ele volta a ser lista de nós/ligações do React Flow. */
export function parseStoredNodes(storedNodes: unknown): Node[] {
  return Array.isArray(storedNodes) ? (storedNodes as Node[]) : [];
}

export function parseStoredEdges(storedEdges: unknown): Edge[] {
  return Array.isArray(storedEdges) ? (storedEdges as Edge[]) : [];
}

export function isNodeCollapsed(node: Node | undefined) {
  return node?.data.collapsed === true;
}

export function getNodeDepth(nodeId: string, nodes: Node[], edges: Edge[]): number {
  if (nodeId === "root") return 0;
  let depth = 0;
  let current = nodeId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const parentEdge = edges.find((e) => e.target === current);
    if (!parentEdge) break;
    current = parentEdge.source;
    depth++;
    if (depth > 20) break;
  }
  return depth;
}

export function getBranchColor(nodeId: string, nodes: Node[], edges: Edge[]): string {
  // Walk up to find the first-level child of root
  let current = nodeId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const parentEdge = edges.find((e) => e.target === current);
    if (!parentEdge) break;
    if (parentEdge.source === "root") {
      // current is a first-level child
      const node = nodes.find((n) => n.id === current);
      return readNodeColor(node) ?? BRANCH_COLORS[0];
    }
    current = parentEdge.source;
  }
  const node = nodes.find((n) => n.id === nodeId);
  return readNodeColor(node) ?? BRANCH_COLORS[0];
}
