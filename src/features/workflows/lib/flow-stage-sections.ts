// Trechos de um fluxo por etapa do funil (spec 0092): em que "Tracking > Status" o lead está em
// cada passo. O gatilho define o primeiro trecho; cada "Mover Lead" configurado abre o seguinte.
// É só leitura do desenho: nada aqui muda o que o fluxo faz.

export interface StageNode {
  id: string;
  type?: string | null;
  data?: unknown;
}

export interface StageEdge {
  source: string;
  target: string;
}

export interface StageSection {
  key: string;
  /** Funil de destino. `null` = o próprio funil do fluxo. */
  trackingId: string | null;
  /** Coluna em que o lead está neste trecho. `null` = qualquer etapa. */
  statusId: string | null;
  /** Passo "Mover Lead" que abriu o trecho. `null` no trecho do gatilho. */
  openedByNodeId: string | null;
  nodeIds: string[];
}

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** Quadros clássicos guardam a configuração em `data.action`; outros, direto em `data`. */
function nodeConfig(data: unknown): Fields {
  const fields = asFields(data);
  return { ...fields, ...asFields(fields.action) };
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Destino de um "Mover Lead" já configurado. `null` enquanto faltar a coluna. */
function moveLeadTarget(node: StageNode): { trackingId: string | null; statusId: string } | null {
  if (node.type !== "MOVE_LEAD") return null;
  const config = nodeConfig(node.data);
  const statusId = textOrNull(config.statusId);
  return statusId ? { trackingId: textOrNull(config.trackingId), statusId } : null;
}

export function splitFlowIntoStageSections(nodes: StageNode[], edges: StageEdge[]): StageSection[] {
  const stepNodes = nodes.filter((node) => node.type !== "INITIAL");
  if (stepNodes.length === 0) return [];
  const nodeById = new Map(stepNodes.map((node) => [node.id, node]));
  const targetsBySource = new Map<string, string[]>();
  const nodesWithIncoming = new Set<string>();
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    targetsBySource.set(edge.source, [...(targetsBySource.get(edge.source) ?? []), edge.target]);
    nodesWithIncoming.add(edge.target);
  }

  const sections = new Map<string, StageSection>();
  const sectionKeyByNode = new Map<string, string>();
  const ensureSection = (section: Omit<StageSection, "nodeIds">): string => {
    if (!sections.has(section.key)) sections.set(section.key, { ...section, nodeIds: [] });
    return section.key;
  };
  const place = (nodeId: string, sectionKey: string) => {
    sectionKeyByNode.set(nodeId, sectionKey);
    sections.get(sectionKey)!.nodeIds.push(nodeId);
  };

  // Começos do fluxo: cada gatilho abre (ou reaproveita) o trecho da coluna que ele observa.
  const queue: string[] = [];
  const roots = stepNodes.filter((node) => !nodesWithIncoming.has(node.id));
  for (const root of roots.length > 0 ? roots : [stepNodes[0]]) {
    const statusId = root.type === "MOVE_LEAD_STATUS" ? textOrNull(nodeConfig(root.data).statusId) : null;
    place(root.id, ensureSection({ key: `start:${statusId ?? "any"}`, trackingId: null, statusId, openedByNodeId: null }));
    queue.push(root.id);
  }

  // Em largura: um passo alcançado por dois caminhos fica no trecho do caminho mais curto.
  while (queue.length > 0) {
    const node = nodeById.get(queue.shift()!)!;
    const target = moveLeadTarget(node);
    const sectionKeyForNext = target
      ? ensureSection({ key: `move:${node.id}`, trackingId: target.trackingId, statusId: target.statusId, openedByNodeId: node.id })
      : sectionKeyByNode.get(node.id)!;
    for (const nextId of targetsBySource.get(node.id) ?? []) {
      if (sectionKeyByNode.has(nextId)) continue;
      place(nextId, sectionKeyForNext);
      queue.push(nextId);
    }
  }

  // Passo que nenhum gatilho alcança (solto ou preso num círculo) fica com o primeiro trecho.
  const firstSectionKey = sections.keys().next().value as string;
  for (const node of stepNodes) if (!sectionKeyByNode.has(node.id)) place(node.id, firstSectionKey);

  return [...sections.values()].filter((section) => section.nodeIds.length > 0);
}
