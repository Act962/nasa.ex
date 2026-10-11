"use client";

import { useAutomationPermissions } from "@/features/workflows/hooks/use-automation-permissions";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import { Background, BackgroundVariant, Controls, Panel, ReactFlow, type Edge, type Node, type NodeChange } from "@xyflow/react";
import { useRouter } from "next/navigation";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { LayoutDashboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/features/editor/components/view-mode-toggle";
import { richNodeSize } from "@/features/editor/components/rich/rich-node-types";
import { editorViewModeAtom } from "@/features/editor/store/atoms";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import type { FlowChannelProvider } from "@/features/workflows/lib/flow-diagnostics";
import { collectFlowProblems } from "@/features/workflows/lib/flow-problems";
import { MAP_FLOW_ID_PREFIX, buildOperationMap, type MapSize, type MapWorkflowInput } from "@/features/workflows/lib/operation-map-graph";
import { useLinkFlows, useUnlinkFlows } from "@/features/workflows/hooks/use-workflows";
import { LINK_REFUSAL_MESSAGES, listFlowLinks, refuseFlowLink } from "@/features/workflows/lib/flow-links";
import { toast } from "sonner";
import { FlowGroupNode, type FlowGroupData } from "./flow-group-node";
import { FlowLinkEdge } from "./flow-link-edge";
import { MapFlowEditor } from "./map-flow-editor";
import { MapEdge } from "./map-edge";
import { MapStepNode, type MapStepData } from "./map-step-node";
import { StageFrameNode, type StageFrameData } from "./stage-frame-node";

// Mapa da operação (spec 0092): todos os fluxos do funil numa tela só. Os retângulos podem ser
// arrastados e a posição fica guardada no navegador; os passos são somente leitura.

const nodeTypes = { flowGroup: FlowGroupNode, stageFrame: StageFrameNode, mapStep: MapStepNode };
const edgeTypes = { mapEdge: MapEdge, flowLink: FlowLinkEdge };
/** Etapa 2 (spec 0092): ligar fluxos pelo mapa. Desligado, o mapa é só leitura. */
const IS_MAP_EDIT_ON = process.env.NEXT_PUBLIC_WORKFLOW_MAP_EDIT === "true";
const ICON_STEP_SIZE: MapSize = { width: 64, height: 64 };

type SavedPositions = Record<string, { x: number; y: number }>;

/** Onde cada pessoa deixou os retângulos, por funil e por visão. Fica no navegador dela. */
const savedPositionsAtom = atomWithStorage<Record<string, SavedPositions>>("orbita:operation-map", {});
const NO_POSITIONS: SavedPositions = {};

interface OperationMapProps {
  trackingId: string;
  workflows: MapWorkflowInput[];
  folders: { id: string; name: string }[];
}

export function OperationMap({ trackingId, workflows, folders }: OperationMapProps) {
  const router = useRouter();
  const isRichView = useAtomValue(editorViewModeAtom) === "rich";
  const { instance } = useQueryInstances(trackingId);
  const provider: FlowChannelProvider = !instance ? "none" : instance.provider === "META_CLOUD" ? "meta" : "uazapi";
  const [positionsByTracking, setPositionsByTracking] = useAtom(savedPositionsAtom);
  // Cada visão guarda a sua disposição: os retângulos têm tamanhos diferentes em Ícones e em Visual.
  const positionsKey = isRichView ? `${trackingId}:rich` : trackingId;
  const savedPositions = positionsByTracking[positionsKey] ?? NO_POSITIONS;

  // Fluxo aberto para edição por cima do mapa (etapa 2).
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const { canEdit } = useAutomationPermissions();
  // Ligar e editar pelo mapa: só com a etapa 2 ligada e para quem pode editar Automações.
  const canEditOnMap = IS_MAP_EDIT_ON && canEdit;
  const linkFlows = useLinkFlows(trackingId);
  const unlinkFlows = useUnlinkFlows(trackingId);
  const requestLink = useCallback(
    (fromWorkflowId: string, toWorkflowId: string) => {
      // A mesma regra roda no servidor; aqui ela evita a ida e volta e explica na hora.
      const refusal = refuseFlowLink({ flows: workflows, fromWorkflowId, toWorkflowId });
      if (refusal) {
        toast.error(LINK_REFUSAL_MESSAGES[refusal]);
        return;
      }
      linkFlows.mutate(
        { fromWorkflowId, toWorkflowId },
        {
          onSuccess: () => toast.success("Fluxos ligados: terminou um, roda o outro."),
          onError: (linkError) => toast.error(linkError.message || "Não consegui ligar os fluxos."),
        },
      );
    },
    [workflows, linkFlows],
  );
  const requestUnlink = useCallback(
    (fromWorkflowId: string, toWorkflowId: string) =>
      unlinkFlows.mutate({ fromWorkflowId, toWorkflowId }, { onError: (unlinkError) => toast.error(unlinkError.message || "Não consegui desfazer a ligação.") }),
    [unlinkFlows],
  );

  const graph = useMemo(() => {
    const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]));
    const groups = buildOperationMap({
      workflows,
      folderOrder: folders.map((folder) => folder.id),
      sizeOfStep: (stepType) => (isRichView ? (richNodeSize(stepType) ?? ICON_STEP_SIZE) : ICON_STEP_SIZE),
      savedPositions,
    });
    const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    for (const group of groups) {
      const workflow = workflowById.get(group.workflowId)!;
      const problems = collectFlowProblems(
        workflow.nodes.filter((node) => node.type !== "INITIAL"),
        workflow.connections.map((connection) => ({ id: connection.id, source: connection.fromNodeId, target: connection.toNodeId, sourceHandle: connection.fromOutput })),
        provider,
      );
      const errors = problems.all.filter((problem) => problem.severity === "error");
      const groupData: FlowGroupData = {
        workflowId: group.workflowId,
        trackingId,
        name: group.name,
        folderName: group.folderId ? (folderNameById.get(group.folderId) ?? null) : null,
        isActive: group.isActive,
        errorCount: errors.length,
        firstErrorTitle: errors[0]?.title ?? null,
        singleStage: group.stages.length === 1 ? { trackingId: group.stages[0].trackingId, statusId: group.stages[0].statusId } : null,
        isEmpty: group.steps.length === 0,
        canToggle: canEdit,
        canLink: canEditOnMap,
        linkTargets: canEditOnMap
          ? workflows.filter((candidate) => candidate.id !== group.workflowId).map((candidate) => ({ id: candidate.id, name: candidate.name }))
          : [],
        onLinkTo: (toWorkflowId) => requestLink(group.workflowId, toWorkflowId),
        onEdit: canEditOnMap ? () => setEditingWorkflowId(group.workflowId) : undefined,
      };
      const groupId = `${MAP_FLOW_ID_PREFIX}${group.workflowId}`;
      // O React Flow exige o retângulo antes dos filhos na lista.
      nodes.push({
        id: groupId,
        type: "flowGroup",
        position: { x: group.x, y: group.y },
        data: groupData,
        style: { width: group.width, height: group.height },
        connectable: canEditOnMap,
      });
      if (group.stages.length > 1) {
        for (const stage of group.stages) {
          const stageData: StageFrameData = { ownTrackingId: trackingId, trackingId: stage.trackingId, statusId: stage.statusId };
          nodes.push({
            id: `${group.workflowId}:stage:${stage.key}`,
            type: "stageFrame",
            parentId: groupId,
            position: { x: stage.x, y: stage.y },
            data: stageData,
            style: { width: stage.width, height: stage.height },
            draggable: false,
            selectable: false,
            connectable: false,
          });
        }
      }
      for (const step of group.steps) {
        const isProblem = Boolean(problems.byNode[step.sourceNodeId]) || problems.blockedNodeIds[step.sourceNodeId] === true;
        const stepData: MapStepData = { nodeType: step.type, nodeData: step.data, tone: isProblem ? "problem" : "ok", isRichView };
        nodes.push({
          id: step.id,
          type: "mapStep",
          parentId: groupId,
          extent: "parent",
          position: { x: step.x, y: step.y },
          data: stepData,
          style: { width: step.width, height: step.height },
          draggable: false,
          connectable: false,
        });
      }
      for (const link of group.links) {
        const sourceNodeId = link.source.slice(group.workflowId.length + 1);
        const isProblem = Boolean(problems.byNode[sourceNodeId]) || problems.blockedNodeIds[sourceNodeId] === true;
        edges.push({ id: link.id, source: link.source, target: link.target, type: "mapEdge", data: { tone: isProblem ? "problem" : "ok" }, selectable: false });
      }
    }
    // Ligações entre fluxos, lidas dos passos de passagem que já existem em cada um.
    for (const link of listFlowLinks(workflows)) {
      edges.push({
        id: `link:${link.fromWorkflowId}:${link.nodeId}`,
        source: `${MAP_FLOW_ID_PREFIX}${link.fromWorkflowId}`,
        target: `${MAP_FLOW_ID_PREFIX}${link.toWorkflowId}`,
        type: "flowLink",
        zIndex: 5,
        selectable: false,
        data: { onUnlink: canEditOnMap ? () => requestUnlink(link.fromWorkflowId, link.toWorkflowId) : undefined },
      });
    }
    return { nodes, edges };
  }, [workflows, folders, isRichView, savedPositions, provider, trackingId, requestLink, requestUnlink, canEdit, canEditOnMap]);

  // Enquanto a pessoa arrasta, a posição vive aqui; ao soltar, vai para o que fica guardado.
  const [draggingPositions, setDraggingPositions] = useState<SavedPositions>({});
  const nodes = useMemo(
    () => graph.nodes.map((node) => (draggingPositions[node.id] ? { ...node, position: draggingPositions[node.id] } : node)),
    [graph.nodes, draggingPositions],
  );
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const moves = changes.flatMap((change) => (change.type === "position" && change.position ? [[change.id, change.position] as const] : []));
    if (moves.length > 0) setDraggingPositions((currentPositions) => ({ ...currentPositions, ...Object.fromEntries(moves) }));
  }, []);

  const savePosition = useCallback(
    (node: Node) => {
      if (!node.id.startsWith(MAP_FLOW_ID_PREFIX)) return;
      const workflowId = node.id.slice(MAP_FLOW_ID_PREFIX.length);
      setPositionsByTracking((currentPositions) => ({
        ...currentPositions,
        [positionsKey]: { ...(currentPositions[positionsKey] ?? {}), [workflowId]: { x: node.position.x, y: node.position.y } },
      }));
      setDraggingPositions({});
    },
    [positionsKey, setPositionsByTracking],
  );

  const resetLayout = () => {
    setDraggingPositions({});
    setPositionsByTracking((currentPositions) => ({ ...currentPositions, [positionsKey]: {} }));
  };

  return (
    <div className="h-[calc(100dvh-13rem)] min-h-[420px] overflow-hidden rounded-2xl border bg-muted/30">
      <ReactFlow
        nodes={nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_event, node) => savePosition(node)}
        onNodeClick={(_event, node) => {
          // Clicar num passo abre o fluxo dele para editar, sem sair do mapa.
          if (canEditOnMap && node.type === "mapStep" && node.parentId) setEditingWorkflowId(node.parentId.slice(MAP_FLOW_ID_PREFIX.length));
        }}
        onNodeDoubleClick={(_event, node) => {
          const groupId = node.id.startsWith(MAP_FLOW_ID_PREFIX) ? node.id : node.parentId;
          if (!groupId) return;
          const workflowId = groupId.slice(MAP_FLOW_ID_PREFIX.length);
          if (canEditOnMap) setEditingWorkflowId(workflowId);
          else router.push(`/tracking/${trackingId}/workflows/${workflowId}`);
        }}
        nodesConnectable={canEditOnMap}
        onConnect={(connection) => {
          if (!connection.source.startsWith(MAP_FLOW_ID_PREFIX) || !connection.target.startsWith(MAP_FLOW_ID_PREFIX)) return;
          requestLink(connection.source.slice(MAP_FLOW_ID_PREFIX.length), connection.target.slice(MAP_FLOW_ID_PREFIX.length));
        }}
        deleteKeyCode={null}
        minZoom={0.08}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} />
        <Panel position="top-right" className="flex items-center gap-2">
          <ViewModeToggle />
          <Button variant="outline" size="sm" className="bg-background" onClick={resetLayout} title="Voltar os retângulos para a disposição automática">
            <LayoutDashboardIcon className="size-4" />
            Organizar
          </Button>
        </Panel>
      </ReactFlow>
      {/* Se o fluxo for apagado dentro do editor, ele some da lista e o editor fecha sozinho. */}
      {editingWorkflowId && workflows.some((workflow) => workflow.id === editingWorkflowId) && (
        <MapFlowEditor trackingId={trackingId} workflowId={editingWorkflowId} onClose={() => setEditingWorkflowId(null)} />
      )}
    </div>
  );
}
