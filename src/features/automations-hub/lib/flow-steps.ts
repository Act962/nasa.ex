// Primeiros passos de um fluxo, na ordem em que acontecem, para resumir a automação numa linha.

interface StepNode {
  id: string;
  type: string;
}

interface StepConnection {
  fromNodeId: string;
  toNodeId: string;
}

/** Tipos dos quadros seguindo a primeira ligação de cada um, a partir do gatilho. */
export function orderedStepTypes(nodes: StepNode[], connections: StepConnection[], maxSteps = 4): string[] {
  if (nodes.length === 0) return [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nextByNode = new Map<string, string>();
  const nodesWithIncoming = new Set<string>();
  for (const connection of connections) {
    nodesWithIncoming.add(connection.toNodeId);
    if (!nextByNode.has(connection.fromNodeId)) nextByNode.set(connection.fromNodeId, connection.toNodeId);
  }
  const start = nodes.find((node) => !nodesWithIncoming.has(node.id) && node.type !== "INITIAL") ?? nodes[0];
  const stepTypes: string[] = [];
  const visited = new Set<string>();
  let current: StepNode | undefined = start;
  while (current && stepTypes.length < maxSteps && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.type !== "INITIAL") stepTypes.push(current.type);
    const nextId = nextByNode.get(current.id);
    current = nextId ? nodeById.get(nextId) : undefined;
  }
  return stepTypes;
}
