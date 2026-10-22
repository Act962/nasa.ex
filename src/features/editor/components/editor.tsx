"use client";
import { useAiButtonPresets } from "@/features/tracking-settings/hooks/use-ai-button-presets";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { toast } from "sonner";

import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
  addEdge,
  type Node,
  type Edge,
  NodeChange,
  EdgeChange,
  Connection,
  type FinalConnectionState,
  Background,
  MiniMap,
  Controls,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";

import "@xyflow/react/dist/style.css";
import { Spinner } from "@/components/ui/spinner";
import { nodeComponents } from "@/config/node-components";
import { OptimizeLayoutButton } from "./optimize-layout-button";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  editorAtom,
  lastSavedSnapshotAtom,
  workflowDirtyAtom,
  flowDiagnosticsAtom,
  editorReadOnlyAtom,
  connectionHoverAtom,
  insertOnEdgeIdAtom,
} from "../store/atoms";
import { NodeType } from "@/generated/prisma/enums";
import { ExecuteWorkflowButton } from "./execute-workflow-button";
import { NodeSelector } from "@/components/node-selector";
import { MenuOptions } from "../../../components/menu-options";
import { nearestSide, oppositeSide, readNodeSides } from "../lib/node-sides";
import { REFUSAL_MESSAGES, refuseConnection } from "../lib/connection-rules";
import { collectFlowProblems } from "@/features/workflows/lib/flow-problems";
import { InspectorMode } from "./inspector-mode";
import { useAutomationPermissions } from "@/features/workflows/hooks/use-automation-permissions";
import { StageSectionsLayer } from "./stage-sections-layer";
import { PauseAnimationsWhenAway } from "./pause-animations-when-away";
import { resolveOverlaps } from "../lib/resolve-overlaps";
import { triggerNodes } from "@/features/tracking-executions/lib/node-options";
import { WorkflowAgentModeProvider } from "@/features/workflows/lib/agent-mode-context";
import { AgentDetailButton } from "@/features/workflows/components/agent-detail-button";
import { StepByStepContainer } from "./step-by-step-container";
import { RateLimitBadge } from "@/features/workflows/components/rate-limit-badge";
import { WorkflowIssuesPanel } from "@/features/workflows/components/workflow-issues-panel";
import { WorkflowIssuesProvider } from "@/features/workflows/components/workflow-issues-context";
import { useWorkflowValidation } from "@/features/workflows/hooks/use-workflow-validation";
import type { GraphIssue } from "@/features/workflows/lib/validate-workflow-graph";
import { ValidatedEdge } from "./validated-edge";
import { SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { EMPTY_FLOW_DIAGNOSTICS, type FlowChannelProvider } from "@/features/workflows/lib/flow-diagnostics";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { useParams } from "next/navigation";
import { WorkflowClipboardButton } from "@/features/workflow-clipboard/components/workflow-clipboard-button";

const TRIGGER_TYPE_SET = new Set(triggerNodes.map((trigger) => String(trigger.type)));

const edgeTypes = {
  // Edge default ganha validação automática — quando algum endpoint tem
  // erro, a linha pulsa em vermelho. Outras edges (sem type explícito)
  // herdam essa por ser o default no React Flow.
  default: ValidatedEdge,
};

export function Editor({ workflowId }: { workflowId: string }) {
  const [openSelector, setOpenSelector] = useState(false);
  const { canEdit } = useAutomationPermissions();
  const isReadOnly = !canEdit;
  const setEditorReadOnly = useSetAtom(editorReadOnlyAtom);
  useEffect(() => {
    setEditorReadOnly(isReadOnly);
    return () => setEditorReadOnly(false);
  }, [isReadOnly, setEditorReadOnly]);

  const { data } = useSuspenseQuery(
    orpc.workflow.getOne.queryOptions({
      input: {
        workflowId,
      },
    }),
  );

  const setEditor = useSetAtom(editorAtom);
  const setLastSavedSnapshot = useSetAtom(lastSavedSnapshotAtom);
  const setDirty = useSetAtom(workflowDirtyAtom);

  const [nodes, setNodes] = useState<Node[]>(data.nodes);
  const [edges, setEdges] = useState<Edge[]>(data.edges);

  // ── Detecção de alterações não salvas ────────────────────────────
  // Compara snapshot atual com o último salvo (atom compartilhado com o
  // save button). Quando difere → marca dirty pra:
  //   1. Breadcrumb "Automações" interceptar clique e mostrar dialog
  //   2. beforeunload alertar no refresh/close do navegador
  //
  // Snapshot inclui só campos relevantes (id, type, position, data) —
  // ignora campos voláteis como `selected`/`dragging` que React Flow
  // muda em cada hover e gerariam falso positivo de dirty.
  const computeSignature = useCallback(
    (ns: Node[], es: Edge[]): string => {
      const cleanNodes = ns.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));
      const cleanEdges = es.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));
      return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
    },
    [],
  );

  // Snapshot inicial (= dados do servidor) só na 1ª render.
  useEffect(() => {
    setLastSavedSnapshot(computeSignature(data.nodes, data.edges));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-checa dirty toda vez que nodes/edges mudam. Lê snapshot via store
  // pra refletir reset após save (sem precisar de prop drilling).
  const lastSavedSnapshot = useAtomValue(lastSavedSnapshotAtom);
  useEffect(() => {
    if (!lastSavedSnapshot) return; // ainda não tem baseline (mount inicial)
    const current = computeSignature(nodes, edges);
    const isDirty = current !== lastSavedSnapshot;
    setDirty(isDirty);
    // Mirror em sessionStorage pra `beforeunload` ler sem closure stale.
    // SessionStorage some no fechar da aba — não vaza dado.
    sessionStorage.setItem("__wf_dirty", JSON.stringify(isDirty));
  }, [nodes, edges, lastSavedSnapshot, computeSignature, setDirty]);

  // beforeunload — refresh/fechar aba mostra dialog nativo do navegador.
  // Chrome ignora string custom em modernos, mas exige `returnValue`.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const dirty = JSON.parse(
        sessionStorage.getItem("__wf_dirty") ?? "false",
      );
      if (!dirty) return;
      e.preventDefault();
      e.returnValue =
        "Você fez alterações na automação. Deseja sair sem salvar?";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      // Limpa flag ao desmontar (navegação dentro do app sai do editor)
      sessionStorage.removeItem("__wf_dirty");
    };
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) =>
      setEdges((edgesSnapshot) => reconnectEdge(oldEdge, newConnection, edgesSnapshot)),
    [],
  );

  // Soltar a ponta da ligação em cima do quadro, fora do pontinho: a ligação encosta no lado mais
  // próximo de onde foi solta. O lado é só desenho (`data.ui`); o identificador da ligação não muda.
  const dropConnectionOnNodeSide = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState, reconnectingEdge?: Edge) => {
      const fixedHandle = connectionState.fromHandle;
      if (connectionState.isValid || !fixedHandle) return;
      const pointer = "changedTouches" in event ? event.changedTouches[0] : event;
      const nodeElement = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest(".react-flow__node");
      const droppedNodeId = nodeElement?.getAttribute("data-id");
      const droppedNode = nodes.find((node) => node.id === droppedNodeId);
      if (!nodeElement || !droppedNode || droppedNode.id === fixedHandle.nodeId) return;

      const movingEnd = fixedHandle.type === "source" ? "target" : "source";
      const isSideChangeOnly = movingEnd === "source" && reconnectingEdge?.source === droppedNode.id;
      // Só religa a saída em outro quadro quando ele tem a saída comum; saídas com nome (sim/não, cada botão) pedem o pontinho certo.
      const hasPlainOutput = Boolean(nodeElement.querySelector('[data-handleid="source-1"]'));
      if (movingEnd === "source" && !isSideChangeOnly && (!reconnectingEdge || !hasPlainOutput)) return;

      if (!isSideChangeOnly) {
        const refusal = refuseConnection({
          sourceId: movingEnd === "target" ? fixedHandle.nodeId : droppedNode.id,
          targetId: movingEnd === "target" ? droppedNode.id : fixedHandle.nodeId,
          nodes,
          edges,
          triggerTypes: TRIGGER_TYPE_SET,
          ignoreEdgeId: reconnectingEdge?.id,
        });
        if (refusal) {
          toast.error(REFUSAL_MESSAGES[refusal]);
          return;
        }
      }

      const droppedSide = nearestSide(nodeElement.getBoundingClientRect(), pointer.clientX, pointer.clientY);
      const sides = readNodeSides(droppedNode.data);
      const changedSides =
        movingEnd === "target"
          ? { inputSide: droppedSide, outputSide: sides.outputSide === droppedSide ? oppositeSide(droppedSide) : sides.outputSide }
          : { outputSide: droppedSide, inputSide: sides.inputSide === droppedSide ? oppositeSide(droppedSide) : sides.inputSide };
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === droppedNode.id ? { ...node, data: { ...node.data, ui: changedSides } } : node)),
      );
      if (isSideChangeOnly) return;
      setEdges((currentEdges) => {
        if (!reconnectingEdge) {
          return addEdge(
            { source: fixedHandle.nodeId, sourceHandle: fixedHandle.id ?? null, target: droppedNode.id, targetHandle: "target-1" },
            currentEdges,
          );
        }
        return currentEdges.map((edge) => {
          if (edge.id !== reconnectingEdge.id) return edge;
          return movingEnd === "target"
            ? { ...edge, target: droppedNode.id, targetHandle: "target-1" }
            : { ...edge, source: droppedNode.id, sourceHandle: "source-1" };
        });
      });
    },
    [nodes, edges],
  );

  const reconnectingEdgeIdRef = useRef<string | null>(null);
  const connectingFromRef = useRef<{ nodeId: string; handleType: string } | null>(null);
  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      !refuseConnection({
        sourceId: connection.source,
        targetId: connection.target,
        nodes,
        edges,
        triggerTypes: TRIGGER_TYPE_SET,
        ignoreEdgeId: reconnectingEdgeIdRef.current ?? undefined,
      }),
    [nodes, edges],
  );

  // Enquanto uma ligação é arrastada, o quadro debaixo do ponteiro mostra se aceita a ligação.
  const [connectionHover, setConnectionHover] = useAtom(connectionHoverAtom);
  const trackConnectionHover = useCallback(
    (hoveredNodeId: string | null) => {
      const from = connectingFromRef.current;
      if (!from || !hoveredNodeId || hoveredNodeId === from.nodeId) {
        setConnectionHover(null);
        return;
      }
      const isAllowed = !refuseConnection({
        sourceId: from.handleType === "source" ? from.nodeId : hoveredNodeId,
        targetId: from.handleType === "source" ? hoveredNodeId : from.nodeId,
        nodes,
        edges,
        triggerTypes: TRIGGER_TYPE_SET,
        ignoreEdgeId: reconnectingEdgeIdRef.current ?? undefined,
      });
      setConnectionHover({ nodeId: hoveredNodeId, isAllowed });
    },
    [nodes, edges, setConnectionHover],
  );
  const endConnectionDrag = useCallback(() => {
    connectingFromRef.current = null;
    reconnectingEdgeIdRef.current = null;
    setConnectionHover(null);
  }, [setConnectionHover]);

  // Quadro nenhum fica em cima de outro: ao soltar um quadro, e quando os tamanhos mudam (troca de
  // visão, cartão que cresceu), os vizinhos abrem espaço.
  const spreadOverlappingNodes = useCallback((fixedNodeId?: string) => {
    setNodes((currentNodes) => {
      const movedPositions = resolveOverlaps(currentNodes, fixedNodeId);
      if (movedPositions.size === 0) return currentNodes;
      return currentNodes.map((node) => (movedPositions.has(node.id) ? { ...node, position: movedPositions.get(node.id)! } : node));
    });
  }, []);
  const measuredSizesSignature = useMemo(
    () => nodes.map((node) => `${node.id}:${Math.round(node.measured?.width ?? 0)}x${Math.round(node.measured?.height ?? 0)}`).join("|"),
    [nodes],
  );
  useEffect(() => {
    // Em somente leitura ninguém salva: mexer nas posições só deixaria um "alteração não salva" falso.
    if (isReadOnly) return;
    spreadOverlappingNodes();
  }, [measuredSizesSignature, spreadOverlappingNodes, isReadOnly]);

  const [insertOnEdgeId, setInsertOnEdgeId] = useAtom(insertOnEdgeIdAtom);
  useEffect(() => {
    if (insertOnEdgeId) setOpenSelector(true);
  }, [insertOnEdgeId]);

  const hasManuelTrigger = useMemo(() => {
    return nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
  }, [nodes]);

  // Quando o usuário cria a automação via Cmd+K → "Automatizar", o palette
  // navega pra cá com `?addNode=<NODE_TYPE>`. Aqui adicionamos esse nó
  // automaticamente conectado ao INITIAL, e limpamos a query string pra
  // não duplicar em re-renders.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const addNodeApplied = useRef(false);

  useEffect(() => {
    if (addNodeApplied.current) return;
    const addNodeParam = searchParams.get("addNode");
    if (!addNodeParam) return;
    // Valida que é um NodeType conhecido (evita injection via URL)
    if (!(addNodeParam in NodeType)) {
      addNodeApplied.current = true;
      return;
    }

    addNodeApplied.current = true;
    const nodeType = addNodeParam as keyof typeof NodeType;
    const isTrigger = triggerNodes.some((t) => t.type === NodeType[nodeType]);

    setNodes((current) => {
      // Se for trigger, só pode 1 — checa duplicação
      if (isTrigger) {
        const hasTrigger = current.some((n) =>
          triggerNodes.some((t) => t.type === n.type),
        );
        if (hasTrigger && current.some((n) => n.type === NodeType.INITIAL)) {
          // Substitui o INITIAL pelo trigger escolhido
          const newId = createId();
          const initial = current.find((n) => n.type === NodeType.INITIAL);
          return [
            ...current.filter((n) => n.type !== NodeType.INITIAL),
            {
              id: newId,
              data: {},
              position: initial?.position ?? { x: 0, y: 0 },
              type: NodeType[nodeType],
            },
          ];
        }
        if (hasTrigger) {
          toast.error("Apenas um gatilho é permitido por workflow.");
          return current;
        }
      }

      // Action ou send-to-app — adiciona node novo abaixo do INITIAL
      const initial = current.find((n) => n.type === NodeType.INITIAL);
      const newId = createId();
      const newNode: Node = {
        id: newId,
        data: {},
        position: {
          x: (initial?.position.x ?? 0) + 250,
          y: initial?.position.y ?? 0,
        },
        type: NodeType[nodeType],
      };

      // Conecta automaticamente se houver INITIAL
      if (initial) {
        setEdges((edgesPrev) => [
          ...edgesPrev,
          {
            id: createId(),
            source: initial.id,
            target: newId,
            sourceHandle: "source-1",
            targetHandle: "target-1",
          },
        ]);
      }

      return [...current, newNode];
    });

    // Limpa a query string sem reloadar a página
    const params = new URLSearchParams(searchParams.toString());
    params.delete("addNode");
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });

    toast.success(
      "Nó adicionado — clique nele pra configurar e depois salve o workflow.",
    );
  }, [searchParams, pathname, router]);

  // Provider envolve tudo — qualquer NodeSelector renderizado embaixo
  // (botão "+" no canvas, no node inicial, no fim de cada execution/trigger
  // node) lê workflowId + agentMode automaticamente do contexto.
  const agentMode = ((data?.workflow as { agentMode?: boolean })?.agentMode ??
    false) as boolean;

  // Issues estruturais do grafo (workflow.validate) — auto-refresh a cada 5s.
  // Cada `BaseExecutionNode`/`BaseTriggerNode` lê via `useNodeIssues(id)` pra
  // pintar borda vermelha e listar problemas no tooltip.
  const { data: validationData } = useWorkflowValidation(workflowId);
  const issuesContextValue = useMemo(
    () => ({
      issuesByNode: (validationData?.issuesByNode ?? {}) as Record<
        string,
        GraphIssue[]
      >,
      allIssues: (validationData?.graphIssues ?? []) as GraphIssue[],
      isLoading: false,
    }),
    [validationData],
  );

  // Previsão de erros sobre o desenho da tela (spec 0090): recalcula quando o conteúdo ou as
  // ligações mudam, não a cada arrasto. O tipo de número do funil decide quais regras valem.
  const { trackingId } = useParams<{ trackingId: string }>();
  const { instance, instanceLoading } = useQueryInstances(trackingId);
  const { presets: savedMenus } = useAiButtonPresets(trackingId ?? "");
  const channelProvider: FlowChannelProvider = !instance ? "none" : instance.provider === "META_CLOUD" ? "meta" : "uazapi";
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const setFlowDiagnostics = useSetAtom(flowDiagnosticsAtom);
  const diagnosticsSignature = useMemo(
    () =>
      JSON.stringify({
        nodes: nodes.map((node) => [node.id, node.type, node.data]),
        edges: edges.map((edge) => [edge.id, edge.source, edge.target, edge.sourceHandle]),
      }),
    [nodes, edges],
  );
  useEffect(() => {
    if (instanceLoading) return;
    const flowDiagnostics = collectFlowProblems(nodes, edges, channelProvider, savedMenus);
    setFlowDiagnostics(flowDiagnostics);
    // A assinatura já resume nós e ligações: depender deles direto recalcularia a cada arrasto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosticsSignature, channelProvider, instanceLoading, setFlowDiagnostics, savedMenus]);
  useEffect(
    () => () => {
      setFlowDiagnostics(EMPTY_FLOW_DIAGNOSTICS);
    },
    [setFlowDiagnostics],
  );

  return (
    <WorkflowAgentModeProvider workflowId={workflowId} agentMode={agentMode}>
      <InspectorMode />
      <PauseAnimationsWhenAway />
     <WorkflowIssuesProvider value={issuesContextValue}>
      <div className="size-full">
        <MenuOptions
          handelOpenSelector={setOpenSelector}
          workflowId={workflowId}
          isDisabled={isReadOnly}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            // Sem a permissão de editar Automações o desenho fica travado: dá para olhar e navegar, não mexer.
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            edgesReconnectable={!isReadOnly}
            deleteKeyCode={isReadOnly ? null : undefined}
            onNodeDragStop={(_event, node) => spreadOverlappingNodes(node.id)}
            isValidConnection={isValidConnection}
            onConnectStart={(_event, params) => {
              connectingFromRef.current = params.nodeId ? { nodeId: params.nodeId, handleType: params.handleType ?? "source" } : null;
            }}
            onConnectEnd={(event, connectionState) => {
              dropConnectionOnNodeSide(event, connectionState);
              endConnectionDrag();
            }}
            onReconnectStart={(_event, edge, handleType) => {
              reconnectingEdgeIdRef.current = edge.id;
              // `handleType` é a ponta que a pessoa pegou; a ligação parte da ponta oposta, que fica presa.
              connectingFromRef.current =
                handleType === "target" ? { nodeId: edge.source, handleType: "source" } : { nodeId: edge.target, handleType: "target" };
            }}
            onReconnectEnd={(event, edge, _handleType, connectionState) => {
              dropConnectionOnNodeSide(event, connectionState, edge);
              endConnectionDrag();
            }}
            onNodeMouseEnter={(_event, node) => trackConnectionHover(node.id)}
            onNodeMouseLeave={() => trackConnectionHover(null)}
            connectionLineStyle={{
              stroke: connectionHover && !connectionHover.isAllowed ? "var(--destructive)" : "var(--info)",
              strokeWidth: 3,
              strokeDasharray: "10 6",
            }}
            nodeTypes={nodeComponents}
            edgeTypes={edgeTypes}
            onInit={setEditor}
            fitView
            snapGrid={[10, 10]}
            snapToGrid
            // panOnScroll
            // panOnDrag={false}
            // selectionOnDrag
          >
            <Background variant={BackgroundVariant.Dots} />
            <StageSectionsLayer />
            <MiniMap position="bottom-right" className="bg-background!" />
            <Controls
              position="bottom-left"
              className="bg-background! text-black!"
            />
            <Panel position="top-right" className="flex items-center gap-2">
              {agentMode && (
                <RateLimitBadge
                  workflowId={workflowId}
                  maxRunsPerHour={
                    Number(
                      (data?.workflow as { maxRunsPerHour?: number })
                        ?.maxRunsPerHour,
                    ) || 60
                  }
                />
              )}
              <WorkflowIssuesPanel workflowId={workflowId} />
              {/* Histórico, passo a passo e clipboard ficam recolhidos em "Configurações". Só escondidos,
                  nunca desmontados: um teste passo a passo em andamento não pode sumir ao recolher. */}
              <div className={isToolsOpen ? "flex items-center gap-2" : "hidden"}>
                {agentMode && <AgentDetailButton workflowId={workflowId} />}
                <StepByStepContainer workflowId={workflowId} />
                <WorkflowClipboardButton
                  workflowId={workflowId}
                  trackingId={(data?.workflow as { trackingId?: string })?.trackingId}
                />
              </div>
              {/* Auto-layout via Dagre — recalcula positions pra eliminar
                  sobreposições. Marca workflow como dirty pra user salvar. */}
              {!isReadOnly && <OptimizeLayoutButton />}
              {!isReadOnly && (
              <Button
                variant={isToolsOpen ? "secondary" : "outline"}
                size="icon"
                className="bg-background"
                title="Configurações: histórico, testar passo a passo e clipboard"
                aria-label="Configurações do fluxo"
                aria-expanded={isToolsOpen}
                onClick={() => setIsToolsOpen((wasOpen) => !wasOpen)}
                data-guide={GUIDE_ANCHORS.workflowToolsButton.id}
              >
                <SettingsIcon className="size-4" />
              </Button>
              )}
            </Panel>
            {hasManuelTrigger && (
              <Panel position="bottom-center">
                <ExecuteWorkflowButton workflowId={workflowId} />
              </Panel>
            )}
            <NodeSelector
              open={openSelector}
              onOpenChange={(isOpen) => {
                setOpenSelector(isOpen);
                if (!isOpen) setInsertOnEdgeId(null);
              }}
              insertOnEdgeId={insertOnEdgeId}
            />
          </ReactFlow>
        </MenuOptions>
      </div>

      {/* <NodeSelector open={openSelector} onOpenChange={setOpenSelector} /> */}
     </WorkflowIssuesProvider>
    </WorkflowAgentModeProvider>
  );
}

export function EditorLoading() {
  return (
    <div className="size-full flex items-center justify-center gap-2">
      <Spinner />
      <span>Carregando...</span>
    </div>
  );
}
