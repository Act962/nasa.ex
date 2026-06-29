import type { Connection, Node } from "@/generated/prisma/client";
import {
  wsExecutionNodes,
  wsTriggerNodes,
} from "@/features/workspace-executions/lib/node-options";

const NODE_LABELS = new Map(
  [...wsTriggerNodes, ...wsExecutionNodes].map((n) => [n.type, n.label]),
);

export function getWorkflowStepsPreview(
  nodes: Node[],
  connections: Connection[],
  max = 5,
): { labels: string[]; total: number } {
  if (nodes.length === 0) return { labels: [], total: 0 };

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, Connection[]>();
  const incomingIds = new Set<string>();
  for (const c of connections) {
    incomingIds.add(c.toNodeId);
    const list = outgoing.get(c.fromNodeId) ?? [];
    list.push(c);
    outgoing.set(c.fromNodeId, list);
  }

  const startCandidates = nodes.filter((n) => !incomingIds.has(n.id));
  const start =
    startCandidates.find((n) =>
      wsTriggerNodes.some((t) => t.type === n.type),
    ) ??
    startCandidates[0] ??
    nodes[0];

  const labels: string[] = [];
  const visited = new Set<string>();
  let current: Node | undefined = start;
  while (current && labels.length < max && !visited.has(current.id)) {
    visited.add(current.id);
    const label = NODE_LABELS.get(current.type) ?? current.name ?? current.type;
    labels.push(label.toUpperCase());
    const nextConn: Connection | undefined = outgoing.get(current.id)?.[0];
    current = nextConn ? nodeById.get(nextConn.toNodeId) : undefined;
  }

  return { labels, total: nodes.length };
}
