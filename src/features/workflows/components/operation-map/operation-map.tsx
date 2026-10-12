"use client";

import { useAutomationPermissions } from "@/features/workflows/hooks/use-automation-permissions";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import { Background, BackgroundVariant, Controls, Panel, ReactFlow, type Edge, type Node, type NodeChange } from "@xyflow/react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { LayoutDashboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/features/editor/components/view-mode-toggle";
import { estimatePhoneHeight } from "@/features/editor/components/rich/message-phone-preview";
import { phoneMessageOf } from "@/features/editor/components/rich/rich-node-preview";
import { RICH_MESSAGE_TYPES, richNodeSize } from "@/features/editor/components/rich/rich-node-types";
import { editorViewModeAtom } from "@/features/editor/store/atoms";
import { MENU_PRESET_NAME } from "@/features/tracking-chat-ai/lib/attendance-setup/script-draft";
import { useAiButtonPresets } from "@/features/tracking-settings/hooks/use-ai-button-presets";
import { useAiCapabilities } from "@/features/tracking-settings/hooks/use-ai-capabilities";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { CENTER_STACK, LEFT_COLUMN_RIGHT_EDGE, buildAttendanceMap, centerStackHeight, placeAttendance } from "@/features/workflows/lib/operation-map-attendance";
import type { FlowChannelProvider } from "@/features/workflows/lib/flow-diagnostics";
import { collectFlowProblems } from "@/features/workflows/lib/flow-problems";
import { MAP_FLOW_ID_PREFIX, layoutOperationMap, type MapSize, type MapWorkflowInput } from "@/features/workflows/lib/operation-map-graph";
import { useLinkFlows, useUnlinkFlows } from "@/features/workflows/hooks/use-workflows";
import { LINK_REFUSAL_MESSAGES, listFlowLinks, refuseFlowLink } from "@/features/workflows/lib/flow-links";
import { toast } from "sonner";
import { FLOW_RIGHT_ENTRY_HANDLE, InfoBlockNode, MenuGroupNode, TagLinkEdge, menuHandleId, type InfoBlockData, type MenuGroupData } from "./attendance-map-nodes";
import { FlowGroupNode, type FlowGroupData } from "./flow-group-node";
import { FlowLinkEdge } from "./flow-link-edge";
import { MapFlowEditor } from "./map-flow-editor";
import { MapEdge } from "./map-edge";
import { MapStepNode, type MapStepData } from "./map-step-node";
import { StageFrameNode, type StageFrameData } from "./stage-frame-node";

// Mapa da operação (spec 0092): todos os fluxos do funil numa tela só. Os retângulos podem ser
// arrastados enquanto a pessoa está na tela (ao voltar, o mapa abre organizado); os passos são somente leitura.

const nodeTypes = { flowGroup: FlowGroupNode, stageFrame: StageFrameNode, mapStep: MapStepNode, menuGroup: MenuGroupNode, infoBlock: InfoBlockNode };
const edgeTypes = { mapEdge: MapEdge, flowLink: FlowLinkEdge, tagLink: TagLinkEdge };
const BOOKING_BLOCK_ID = "attendance:booking";
const ASSISTANT_BLOCK_ID = "attendance:assistant";
/** Etapa 2 (spec 0092): ligar fluxos pelo mapa. Desligado, o mapa é só leitura. */
const IS_MAP_EDIT_ON = process.env.NEXT_PUBLIC_WORKFLOW_MAP_EDIT === "true";
const ICON_STEP_SIZE: MapSize = { width: 64, height: 64 };
/** Folga em volta do celular dentro do quadro tracejado do passo. */
const PHONE_FRAME_MARGIN = 16;

type SavedPositions = Record<string, { x: number; y: number }>;

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
  // O que a pessoa arrasta vale só enquanto ela está na tela: ao sair e voltar, o mapa volta organizado.
  const [positionsByTracking, setPositionsByTracking] = useState<Record<string, SavedPositions>>({});
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

  // Menu do atendimento e ligações por tag: mostram por que cada fluxo começa (spec 0092).
  const { presets } = useAiButtonPresets(trackingId);
  const { data: aiCapabilities } = useAiCapabilities(trackingId);
  const hasBookingMenu = Boolean(aiCapabilities?.capabilities.guidedMenu && aiCapabilities.capabilities.agenda.isEnabled && aiCapabilities.availableAgendas.length > 0);
  const attendance = useMemo(
    () => buildAttendanceMap({ menus: presets, workflows, scriptMenuName: MENU_PRESET_NAME, hasBookingMenu }),
    [presets, workflows, hasBookingMenu],
  );

  const presetById = useMemo(() => new Map(presets.map((preset) => [preset.id, preset as unknown as Record<string, unknown>])), [presets]);

  const graph = useMemo(() => {
    const flowsWithError = new Set<string>();
    const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]));
    const { groups, centerY } = layoutOperationMap({
      workflows,
      folderOrder: folders.map((folder) => folder.id),
      sizeOfStep: (stepType, stepData) => {
        if (!isRichView) return ICON_STEP_SIZE;
        const baseSize = richNodeSize(stepType) ?? ICON_STEP_SIZE;
        if (!RICH_MESSAGE_TYPES.has(stepType)) return baseSize;
        // O celular cresce com o texto e as opções: altura fixa deixava a lista para fora do quadro.
        return { width: baseSize.width, height: estimatePhoneHeight(phoneMessageOf(stepType, stepData, presetById)) + PHONE_FRAME_MARGIN };
      },
      savedPositions,
      preferredOrder: attendance.linkedWorkflowOrder,
      menuColumns: {
        right: attendance.rightWorkflowOrder,
        left: attendance.leftWorkflowOrder,
        leftColumnRightEdge: LEFT_COLUMN_RIGHT_EDGE,
        centerStackHeight: centerStackHeight(attendance),
        centerStackLeft: CENTER_STACK.left,
        centerStackWidth: CENTER_STACK.width,
      },
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
        presets,
      );
      const errors = problems.all.filter((problem) => problem.severity === "error");
      if (errors.length > 0) flowsWithError.add(group.workflowId);
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
    // Menu do atendimento no meio, entre as duas colunas de fluxos, com uma linha reta por opção.
    const placedAttendance = placeAttendance(attendance, groups, centerY);
    const settingsHref = (iaTab: string) => `/tracking/${trackingId}/settings?tab=chatbot-ia&iaTab=${iaTab}`;
    const fixedNode = { draggable: false, connectable: false, selectable: false } as const;
    const infoBlock = (id: string, box: { x: number; y: number; width: number; height: number }, data: InfoBlockData): Node => ({
      id,
      type: "infoBlock",
      position: { x: box.x, y: box.y },
      data,
      style: { width: box.width, height: box.height },
      ...fixedNode,
    });
    for (const menu of placedAttendance.menus) {
      const menuData: MenuGroupData = { name: menu.name, href: settingsHref("buttons"), isActive: menu.isActive, options: menu.options };
      nodes.push({ id: `menu:${menu.id}`, type: "menuGroup", position: { x: menu.x, y: menu.y }, data: menuData, style: { width: menu.width, height: menu.height }, ...fixedNode });
    }
    if (placedAttendance.bookingBlock) {
      nodes.push(infoBlock(BOOKING_BLOCK_ID, placedAttendance.bookingBlock, { title: "Agendamento por botões", lines: ["Escolhe agenda, dia e horário e marca, sem IA.", "Não é um fluxo: abre o atendimento."], tone: "booking", href: settingsHref("capabilities") }));
    }
    if (placedAttendance.assistantBlock) {
      nodes.push(infoBlock(ASSISTANT_BLOCK_ID, placedAttendance.assistantBlock, { title: "Assistente (IA)", lines: ["Responde o que vem depois da abertura", "de cada assunto."], tone: "assistant", href: settingsHref("general") }));
    }
    for (const menuEdge of placedAttendance.menuEdges) {
      edges.push({
        id: `menu-link:${menuEdge.menuId}:${menuEdge.optionId}:${menuEdge.workflowId}`,
        source: `menu:${menuEdge.menuId}`,
        sourceHandle: menuHandleId(menuEdge.optionId, menuEdge.side),
        target: `${MAP_FLOW_ID_PREFIX}${menuEdge.workflowId}`,
        // O fluxo à esquerda do menu recebe a linha pela borda direita dele.
        targetHandle: menuEdge.side === "left" ? FLOW_RIGHT_ENTRY_HANDLE : undefined,
        type: "tagLink",
        data: { kind: "menu", channelX: menuEdge.channelX, tone: flowsWithError.has(menuEdge.workflowId) ? "problem" : "ok" },
        selectable: false,
      });
    }
    for (const bookingEdge of placedAttendance.bookingEdges) {
      edges.push({
        id: `booking-link:${bookingEdge.menuId}:${bookingEdge.optionId}`,
        source: `menu:${bookingEdge.menuId}`,
        sourceHandle: menuHandleId(bookingEdge.optionId, "right"),
        target: BOOKING_BLOCK_ID,
        type: "tagLink",
        data: { kind: "booking", channelX: bookingEdge.channelX, endsOnChannel: true },
        selectable: false,
      });
    }
    for (const link of attendance.tagLinks) {
      edges.push({ id: `tag-link:${link.fromWorkflowId}:${link.toWorkflowId}`, source: `${MAP_FLOW_ID_PREFIX}${link.fromWorkflowId}`, target: `${MAP_FLOW_ID_PREFIX}${link.toWorkflowId}`, type: "tagLink", data: { kind: "tag", tone: flowsWithError.has(link.toWorkflowId) ? "problem" : "ok" }, selectable: false });
    }
    return { nodes, edges };
  }, [workflows, folders, isRichView, savedPositions, provider, trackingId, requestLink, requestUnlink, canEdit, canEditOnMap, attendance, presetById, presets]);

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
          // Menu, agendamento e assistente não se editam aqui: o clique leva à tela de cada um.
          if (node.type === "menuGroup" || node.type === "infoBlock") {
            router.push((node.data as { href: string }).href);
            return;
          }
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
