/** Grafo do mapa mental (nós e ligações salvos em `NasaPlannerMindMap.nodes/edges`) e utilitários puros. */

export type MapNodeType = "mindMapRoot" | "topic" | "stickyNote" | "cardNode" | "postNode" | "linkNode";

export interface MapNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
}

/** Cores dos ramos. São hex porque o nó de tópico monta o gradiente somando a opacidade ao código. */
export const BRANCH_COLORS = [
  "#7C3AED",
  "#EC4899",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
  "#8B5CF6",
  "#F97316",
  "#14B8A6",
];

export const ROOT_NODE_ID = "root";

export function childIdsOf(nodeId: string, edges: MapEdge[]) {
  return edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
}

export function parentIdOf(nodeId: string, edges: MapEdge[]) {
  return edges.find((edge) => edge.target === nodeId)?.source ?? null;
}

/** Sobe do nó até a raiz e devolve o primeiro tópico de dia (com `weekday`) do caminho. */
export function findDayTopic<NodeLike extends MapNode>(nodeId: string, nodes: NodeLike[], edges: MapEdge[]): NodeLike | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const visited = new Set<string>();
  let currentId: string | null = nodeId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const current = nodeById.get(currentId);
    if (current?.type === "topic" && typeof current.data.weekday === "number") return current;
    currentId = parentIdOf(currentId, edges);
  }
  return null;
}

export function collectSubtreeIds(nodeId: string, edges: MapEdge[]) {
  const subtree = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const childId of childIdsOf(currentId, edges)) {
      if (subtree.has(childId)) continue;
      subtree.add(childId);
      queue.push(childId);
    }
  }
  return subtree;
}

export interface OutlineItem<NodeLike extends MapNode = MapNode> {
  node: NodeLike;
  children: OutlineItem<NodeLike>[];
}

/** Árvore a partir da raiz, na ordem em que os nós aparecem na tela (de cima para baixo). Nós soltos vão no fim. */
export function buildOutline<NodeLike extends MapNode>(nodes: NodeLike[], edges: MapEdge[]): { root: OutlineItem<NodeLike> | null; loose: NodeLike[] } {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const visited = new Set<string>();
  const build = (nodeId: string): OutlineItem<NodeLike> | null => {
    const node = nodeById.get(nodeId);
    if (!node || visited.has(nodeId)) return null;
    visited.add(nodeId);
    const children = childIdsOf(nodeId, edges)
      .map((childId) => nodeById.get(childId))
      .filter((child): child is NodeLike => Boolean(child))
      .sort((first, second) => first.position.y - second.position.y || first.position.x - second.position.x)
      .map((child) => build(child.id))
      .filter((item): item is OutlineItem<NodeLike> => item !== null);
    return { node, children };
  };
  const rootNode = nodes.find((node) => node.type === "mindMapRoot") ?? nodes.find((node) => !parentIdOf(node.id, edges));
  const root = rootNode ? build(rootNode.id) : null;
  return { root, loose: nodes.filter((node) => !visited.has(node.id)) };
}

const NODE_SIZE: Record<string, { width: number; height: number }> = {
  mindMapRoot: { width: 200, height: 64 },
  topic: { width: 230, height: 56 },
  postNode: { width: 260, height: 78 },
  cardNode: { width: 240, height: 78 },
  linkNode: { width: 230, height: 38 },
  stickyNote: { width: 200, height: 56 },
};
const DEFAULT_NODE_SIZE = { width: 220, height: 56 };
const COLUMN_GAP = 70;
const ROW_GAP = 16;

/** Organiza em árvore da esquerda para a direita: cada nível numa coluna, pai centralizado nos filhos. */
export function layoutTree<NodeLike extends MapNode>(nodes: NodeLike[], edges: MapEdge[]): NodeLike[] {
  const { root, loose } = buildOutline(nodes, edges);
  if (!root) return nodes;
  const positionById = new Map<string, { x: number; y: number }>();
  const columnXByDepth: number[] = [];
  const widestByDepth: number[] = [];
  const measure = (item: OutlineItem<NodeLike>, depth: number) => {
    const size = NODE_SIZE[item.node.type ?? ""] ?? DEFAULT_NODE_SIZE;
    widestByDepth[depth] = Math.max(widestByDepth[depth] ?? 0, size.width);
    item.children.forEach((child) => measure(child, depth + 1));
  };
  measure(root, 0);
  widestByDepth.reduce((offset, width, depth) => {
    columnXByDepth[depth] = offset;
    return offset + width + COLUMN_GAP;
  }, 0);

  let nextLeafY = 0;
  const place = (item: OutlineItem<NodeLike>, depth: number): number => {
    const size = NODE_SIZE[item.node.type ?? ""] ?? DEFAULT_NODE_SIZE;
    let centerY: number;
    if (item.children.length === 0) {
      centerY = nextLeafY + size.height / 2;
      nextLeafY += size.height + ROW_GAP;
    } else {
      const childCenters = item.children.map((child) => place(child, depth + 1));
      centerY = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
      // Um pai mais alto que os filhos não pode invadir o ramo de baixo.
      nextLeafY = Math.max(nextLeafY, centerY + size.height / 2 + ROW_GAP);
    }
    positionById.set(item.node.id, { x: columnXByDepth[depth], y: centerY - size.height / 2 });
    return centerY;
  };
  place(root, 0);

  loose.forEach((looseNode, looseIndex) => {
    positionById.set(looseNode.id, { x: looseIndex * 250, y: nextLeafY + 40 });
  });
  return nodes.map((node) => ({ ...node, position: positionById.get(node.id) ?? node.position }));
}
