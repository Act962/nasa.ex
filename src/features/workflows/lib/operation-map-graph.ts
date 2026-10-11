import { resolveOverlaps } from "@/features/editor/lib/resolve-overlaps";
import { splitFlowIntoStageSections, type StageSection } from "./flow-stage-sections";

// Mapa da operação (spec 0092): todos os fluxos de um funil num canvas só. Cada fluxo vira um
// retângulo com os seus passos dentro. Função pura: recebe o que `workflow.list` devolve e devolve
// quadros e ligações prontos para o React Flow, sem tocar em banco nem em tela.

export interface MapWorkflowInput {
  id: string;
  name: string;
  isActive: boolean;
  agentMode?: boolean;
  folderId?: string | null;
  nodes: { id: string; type: string; position: unknown; data: unknown }[];
  connections: { id: string; fromNodeId: string; toNodeId: string; fromOutput?: string | null }[];
}

export interface MapSize {
  width: number;
  height: number;
}

interface MapBox extends MapSize {
  x: number;
  y: number;
}

export interface MapStageBox extends MapBox {
  key: string;
  trackingId: string | null;
  statusId: string | null;
}

export interface MapFlowGroup extends MapBox {
  workflowId: string;
  name: string;
  isActive: boolean;
  agentMode: boolean;
  folderId: string | null;
  /** Um trecho só: a etiqueta vai direto no retângulo do fluxo. Mais de um: cada trecho tem a sua moldura. */
  stages: MapStageBox[];
  steps: { id: string; sourceNodeId: string; type: string; data: unknown; x: number; y: number; width: number; height: number }[];
  links: { id: string; source: string; target: string }[];
}

export const MAP_LAYOUT = {
  /** Espaço para o nome do fluxo, a etiqueta e os botões em cima do retângulo. */
  headerHeight: 76,
  padding: 36,
  /** Nome do passo, escrito embaixo de cada quadro. */
  stepLabelHeight: 44,
  stagePadding: 18,
  stageLabelHeight: 26,
  groupGap: 72,
  rowMaxWidth: 2600,
  emptyGroup: { width: 320, height: 150 },
} as const;

export const MAP_FLOW_ID_PREFIX = "flow:";

function readPosition(position: unknown): { x: number; y: number } {
  const point = (position && typeof position === "object" ? position : {}) as { x?: unknown; y?: unknown };
  return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
}

function boundingBox(boxes: MapBox[]): MapBox {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function stageBoxes(sections: StageSection[], stepBoxByNodeId: Map<string, MapBox>): MapStageBox[] {
  return sections.map((section) => {
    const box = boundingBox(section.nodeIds.map((nodeId) => stepBoxByNodeId.get(nodeId)!));
    return {
      key: section.key,
      trackingId: section.trackingId,
      statusId: section.statusId,
      x: box.x - MAP_LAYOUT.stagePadding,
      y: box.y - MAP_LAYOUT.stagePadding - MAP_LAYOUT.stageLabelHeight,
      width: box.width + MAP_LAYOUT.stagePadding * 2,
      height: box.height + MAP_LAYOUT.stagePadding * 2 + MAP_LAYOUT.stageLabelHeight + MAP_LAYOUT.stepLabelHeight,
    };
  });
}

/** Um fluxo: os passos reposicionados para dentro do retângulo, na mesma disposição do editor. */
function buildGroup(workflow: MapWorkflowInput, sizeOfStep: (type: string) => MapSize): Omit<MapFlowGroup, "x" | "y"> {
  const steps = workflow.nodes.filter((node) => node.type !== "INITIAL");
  const base = {
    workflowId: workflow.id,
    name: workflow.name,
    isActive: workflow.isActive,
    agentMode: workflow.agentMode === true,
    folderId: workflow.folderId ?? null,
  };
  if (steps.length === 0) return { ...base, ...MAP_LAYOUT.emptyGroup, stages: [], steps: [], links: [] };

  const editorBoxes = steps.map((step) => ({ id: step.id, position: readPosition(step.position), measured: sizeOfStep(step.type) }));
  // Na visão Visual os quadros são maiores que os do editor em Ícones: quem ficaria em cima do outro abre espaço.
  const spreadPositions = resolveOverlaps(editorBoxes);
  const rawBoxes = editorBoxes.map((box) => ({ ...(spreadPositions.get(box.id) ?? box.position), ...box.measured }));
  const origin = boundingBox(rawBoxes);
  const sections = splitFlowIntoStageSections(
    steps,
    workflow.connections.map((connection) => ({ source: connection.fromNodeId, target: connection.toNodeId })),
  );
  const hasStageFrames = sections.length > 1;
  // Com molduras de trecho, sobra espaço em volta para elas não encostarem na borda do fluxo.
  const inset = MAP_LAYOUT.padding + (hasStageFrames ? MAP_LAYOUT.stagePadding : 0);
  const topInset = MAP_LAYOUT.headerHeight + (hasStageFrames ? MAP_LAYOUT.stagePadding + MAP_LAYOUT.stageLabelHeight : 0);

  const stepBoxByNodeId = new Map<string, MapBox>();
  const placedSteps = steps.map((step, stepIndex) => {
    const box = {
      x: rawBoxes[stepIndex].x - origin.x + inset,
      y: rawBoxes[stepIndex].y - origin.y + topInset,
      width: rawBoxes[stepIndex].width,
      height: rawBoxes[stepIndex].height,
    };
    stepBoxByNodeId.set(step.id, box);
    return { id: `${workflow.id}:${step.id}`, sourceNodeId: step.id, type: step.type, data: step.data, ...box };
  });

  return {
    ...base,
    width: origin.width + inset * 2,
    height: origin.height + topInset + MAP_LAYOUT.stepLabelHeight + inset,
    stages: stageBoxes(sections, stepBoxByNodeId),
    steps: placedSteps,
    links: workflow.connections
      .filter((connection) => stepBoxByNodeId.has(connection.fromNodeId) && stepBoxByNodeId.has(connection.toNodeId))
      .map((connection) => ({
        id: `${workflow.id}:${connection.id}`,
        source: `${workflow.id}:${connection.fromNodeId}`,
        target: `${workflow.id}:${connection.toNodeId}`,
      })),
  };
}

function overlapsWithGap(first: MapBox, second: MapBox): boolean {
  const gap = MAP_LAYOUT.groupGap / 2;
  return first.x < second.x + second.width + gap && second.x < first.x + first.width + gap && first.y < second.y + second.height + gap && second.y < first.y + first.height + gap;
}

const MAX_PLACEMENT_TRIES = 400;

/**
 * Todos os fluxos, já dispostos e sem nenhum retângulo em cima de outro. Os da mesma pasta ficam
 * juntos, ativos primeiro e em ordem de nome, em fileiras que quebram na largura máxima. Posição que
 * a pessoa já arrastou (`savedPositions`) vale no lugar da automática: os demais se encaixam em volta
 * dela, e dois arrastados que ficaram sobrepostos (o tamanho muda entre Ícones e Visual) se afastam.
 */
export function buildOperationMap(params: {
  workflows: MapWorkflowInput[];
  folderOrder: string[];
  sizeOfStep: (type: string) => MapSize;
  savedPositions?: Record<string, { x: number; y: number }>;
}): MapFlowGroup[] {
  const folderRank = new Map(params.folderOrder.map((folderId, folderIndex) => [folderId, folderIndex]));
  const rankOf = (workflow: MapWorkflowInput) =>
    workflow.folderId && folderRank.has(workflow.folderId) ? folderRank.get(workflow.folderId)! : params.folderOrder.length;
  const ordered = [...params.workflows].sort(
    (first, second) =>
      rankOf(first) - rankOf(second) || Number(second.isActive) - Number(first.isActive) || first.name.localeCompare(second.name, "pt-BR", { numeric: true }),
  );
  const builtGroups = ordered.map((workflow) => buildGroup(workflow, params.sizeOfStep));
  const placedByWorkflowId = new Map<string, MapFlowGroup>();
  const placed: MapFlowGroup[] = [];
  const place = (group: Omit<MapFlowGroup, "x" | "y">, x: number, y: number) => {
    const placedGroup = { ...group, x, y };
    placed.push(placedGroup);
    placedByWorkflowId.set(group.workflowId, placedGroup);
  };

  // 1. Os que a pessoa arrastou ficam onde ela deixou; se dois se sobrepõem, o de baixo desce.
  const savedGroups = builtGroups
    .filter((group) => params.savedPositions?.[group.workflowId])
    .map((group) => ({ group, saved: params.savedPositions![group.workflowId] }))
    .sort((first, second) => first.saved.y - second.saved.y || first.saved.x - second.saved.x);
  for (const { group, saved } of savedGroups) {
    let y = saved.y;
    for (let tries = 0; tries < MAX_PLACEMENT_TRIES; tries += 1) {
      const collider = placed.find((other) => overlapsWithGap({ ...group, x: saved.x, y }, other));
      if (!collider) break;
      y = collider.y + collider.height + MAP_LAYOUT.groupGap;
    }
    place(group, saved.x, y);
  }

  // 2. Os demais entram em fileiras, pulando o espaço já ocupado.
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let previousFolderId: string | null | undefined;
  for (const group of builtGroups) {
    if (placedByWorkflowId.has(group.workflowId)) continue;
    const startsNewFolder = previousFolderId !== undefined && previousFolderId !== group.folderId;
    if (cursorX > 0 && startsNewFolder) {
      cursorX = 0;
      cursorY += rowHeight + MAP_LAYOUT.groupGap;
      rowHeight = 0;
    }
    for (let tries = 0; tries < MAX_PLACEMENT_TRIES; tries += 1) {
      if (cursorX > 0 && cursorX + group.width > MAP_LAYOUT.rowMaxWidth) {
        cursorX = 0;
        cursorY += rowHeight + MAP_LAYOUT.groupGap;
        rowHeight = 0;
      }
      const candidate = { ...group, x: cursorX, y: cursorY };
      const collider = placed.find((other) => overlapsWithGap(candidate, other));
      if (!collider) break;
      const nextX = collider.x + collider.width + MAP_LAYOUT.groupGap;
      if (nextX + group.width > MAP_LAYOUT.rowMaxWidth) {
        // Não cabe ao lado do obstáculo: desce para baixo dele e recomeça a fileira.
        cursorX = 0;
        cursorY = Math.max(cursorY + rowHeight + MAP_LAYOUT.groupGap, collider.y + collider.height + MAP_LAYOUT.groupGap);
        rowHeight = 0;
      } else {
        cursorX = Math.max(nextX, 0);
      }
    }
    place(group, cursorX, cursorY);
    cursorX += group.width + MAP_LAYOUT.groupGap;
    rowHeight = Math.max(rowHeight, group.height);
    previousFolderId = group.folderId;
  }
  return builtGroups.map((group) => placedByWorkflowId.get(group.workflowId)!);
}
