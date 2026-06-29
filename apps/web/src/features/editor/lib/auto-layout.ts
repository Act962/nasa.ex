/**
 * Auto-layout de workflows React Flow usando Dagre.
 *
 * Resolve o problema crônico de nós colidindo, labels sobrepostos e edges
 * cruzadas (especialmente em workflows complexos como o preset
 * "proposta-contrato" com 30 nós). Calcula positions limpas em fluxo
 * horizontal (LR — left to right) com spacing generoso entre ranks.
 *
 * Uso típico (botão "Otimizar Visualização" no Panel do editor):
 *   const { nodes: laidOut } = autoLayoutWorkflow(currentNodes, currentEdges);
 *   setNodes(laidOut);
 *   reactFlowInstance?.fitView({ padding: 0.15, duration: 600 });
 *
 * Não muda `edges` — só recalcula `node.position` mantendo todo o resto
 * (data, type, id, etc) intacto.
 */
import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

export interface AutoLayoutOptions {
  /**
   * Direção do fluxo. Default "LR" (esquerda → direita), que combina com
   * o pattern usado nos presets (trigger no canto esquerdo, terminais à
   * direita). Outras opções: "TB" (top → bottom), "BT", "RL".
   */
  direction?: "LR" | "TB" | "BT" | "RL";
  /**
   * Largura assumida pra cada nó. Como o React Flow do projeto usa nós
   * de tamanho variável (size-auto + p-4), Dagre precisa de uma estimativa.
   * Default 220 — cobre rótulos curtos como "Enviar Mensagem", "Decisão da IA".
   */
  nodeWidth?: number;
  /**
   * Altura assumida pra cada nó (default 80 — bate com o tamanho real
   * dos nós BaseNode + label embaixo).
   */
  nodeHeight?: number;
  /**
   * Espaçamento entre nós no MESMO rank (mesma coluna em LR). Default 80.
   */
  nodeSep?: number;
  /**
   * Espaçamento entre RANKS (entre colunas em LR). Default 160 — generoso
   * pra evitar labels colidirem em transições com muitas branches.
   */
  rankSep?: number;
}

export interface AutoLayoutResult {
  nodes: Node[];
  /** Bounding box do layout final. Pro caller saber se vale fitView. */
  bounds: { width: number; height: number };
}

export function autoLayoutWorkflow(
  nodes: Node[],
  edges: Edge[],
  opts: AutoLayoutOptions = {},
): AutoLayoutResult {
  const {
    direction = "LR",
    nodeWidth = 220,
    nodeHeight = 80,
    nodeSep = 80,
    rankSep = 160,
  } = opts;

  // Grafo Dagre — direcionado (workflows são DAG), sem multi-edges.
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    // marginx/marginy adicionam padding ao bounding box final
    marginx: 40,
    marginy: 40,
  });
  // Default edge label vazio — Dagre exige `setDefaultEdgeLabel`.
  g.setDefaultEdgeLabel(() => ({}));

  // Registra cada node com sua dimensão estimada.
  for (const node of nodes) {
    // Permite override por nó via `node.width`/`node.height` se algum nó
    // grande (ex: SEND_MESSAGE com texto longo) tiver tamanho conhecido.
    const w = node.width ?? nodeWidth;
    const h = node.height ?? nodeHeight;
    g.setNode(node.id, { width: w, height: h });
  }

  // Registra cada edge. Dagre usa pra calcular ranking.
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Algoritmo principal — Dagre calcula tudo em 1 chamada.
  dagre.layout(g);

  // Aplica positions calculadas. Dagre retorna CENTRO do node; React Flow
  // espera o canto SUPERIOR ESQUERDO — subtraímos metade w/h.
  const laidOutNodes: Node[] = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node; // node órfão — mantém position original
    const w = node.width ?? nodeWidth;
    const h = node.height ?? nodeHeight;
    return {
      ...node,
      position: {
        x: dagreNode.x - w / 2,
        y: dagreNode.y - h / 2,
      },
      // React Flow precisa saber que veio de auto-layout pra animar
      // suavemente entre positions antigas e novas.
      positionAbsolute: undefined,
    };
  });

  const graphBounds = g.graph();
  return {
    nodes: laidOutNodes,
    bounds: {
      width: graphBounds.width ?? 0,
      height: graphBounds.height ?? 0,
    },
  };
}
