"use client";
import { RichNodePreview } from "@/features/editor/components/rich/rich-node-preview";
import { IconNodeCaption, IconNodeGlyph, hasIconCaption, hasIconGlyph } from "@/features/editor/components/rich/icon-node-hint";
import { FlowNoticeBadge } from "@/features/editor/components/rich/flow-notice-badge";
import { AnimatedOutline, type OutlineTone } from "@/features/editor/components/rich/animated-outline";
import { hasRichPreview } from "@/features/editor/components/rich/rich-node-types";
import { connectionHoverAtom, editorReadOnlyAtom, editorViewModeAtom } from "@/features/editor/store/atoms";
import { useIsNodeBlockedByFlowProblem, useNodeFlowDiagnostics } from "@/features/editor/hooks/use-flow-diagnostics";

import {
  ConnectionState,
  type NodeProps,
  Position,
  useConnection,
  useReactFlow,
  useUpdateNodeInternals,
  useStore,
} from "@xyflow/react";
import { PlusIcon, type LucideIcon } from "lucide-react";
import { createId } from "@paralleldrive/cuid2";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { WorkflowNode } from "@/components/workflow-node";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { validateNode } from "@/features/workflows/lib/validate-node";
import { useNodeIssues } from "@/features/workflows/components/workflow-issues-context";
import { useAtomValue } from "jotai";
import { stepByStepStateAtom } from "@/features/editor/store/step-by-step-atoms";
import { StepRocketOverlay } from "@/features/editor/components/step-rocket-overlay";
import Image from "next/image";
import { BaseHandle } from "@/components/react-flow/base-handle";
import {
  type NodeStatus,
  NodeStatusIndicator,
} from "@/components/react-flow/node-status-indicator";
import { nextSide, readNodeSides, toPosition } from "@/features/editor/lib/node-sides";
import { ButtonHandle } from "@/components/react-flow/button-handle";
import { AddNextNodeButton } from "@/features/editor/components/add-next-node-button";
import { NodeSelector } from "@/components/node-selector";

interface BaseTriggerNodeProps extends NodeProps {
  icon: LucideIcon | string;
  name: string;
  description?: string;
  children?: ReactNode;
  status?: NodeStatus;
  onSettings?: () => void;
  onDoubleClick?: () => void;
}

const selector = (connection: ConnectionState) => {
  return connection.inProgress;
};

export const BaseTriggerNode = memo(
  ({
    id,
    icon: Icon,
    name,
    description,
    children,
    status = "initial",
    onSettings,
    onDoubleClick,
    ...rest
  }: BaseTriggerNodeProps) => {
    const { setNodes, setEdges } = useReactFlow();
    // Validação automática — usa o `type` + `data` que vem via NodeProps.
    // Toda action/trigger ganha borda colorida + tooltip de erros sem
    // precisar mudar cada `*/node.tsx`.
    const nodeType = (rest as any).type as string | undefined;
    const nodeData = (rest as any).data as Record<string, unknown> | undefined;
    const validation = useMemo(
      () => (nodeType ? validateNode(nodeType, nodeData) : undefined),
      [nodeType, nodeData],
    );
    const [openSelector, setOpenSelector] = useState(false);
    const connectionInProgress = useConnection(selector);
    const isConnected = useStore((state) =>
      state.edges.some(
        (edge) => edge.source === id && edge.sourceHandle === "source-1",
      ),
    );

    const isReadOnly = useAtomValue(editorReadOnlyAtom);
    const shouldShowButton = !connectionInProgress && !isConnected && !isReadOnly;

    const handleDelete = () => {
      setNodes((currentNodes) => {
        const updateNodes = currentNodes.filter((node) => node.id !== id);
        return updateNodes;
      });

      setEdges((currentEdges) => {
        const updateEdges = currentEdges.filter(
          (edge) => edge.source !== id && edge.target !== id,
        );
        return updateEdges;
      });
    };

    const handleDuplicate = () => {
      setNodes((currentNodes) => {
        const original = currentNodes.find((n) => n.id === id);
        if (!original) return currentNodes;
        const clone = {
          ...original,
          id: createId(),
          position: {
            x: original.position.x + 40,
            y: original.position.y + 40,
          },
          selected: false,
          data: JSON.parse(JSON.stringify(original.data ?? {})),
        };
        return [...currentNodes, clone];
      });
    };

    const handleAddNext = () => setOpenSelector(true);

    // Issues estruturais do grafo (TRIGGER_DISCONNECTED, ARCHIVED_TAG no
    // LEAD_TAGGED, etc) também forçam borda vermelha — bug clássico do
    // "Agente de Agendamento" caía aqui silenciosamente porque NEW_LEAD
    // sem aresta de saída ficava verde.
    const graphIssues = useNodeIssues(id);
    const hasGraphError = graphIssues.some((i) => i.severity === "error");
    // Erros previstos sobre o desenho da tela (regras do canal). O erro vem antes do aviso.
    const flowDiagnostics = useNodeFlowDiagnostics(id);
    const flowNotice =
      flowDiagnostics.find((diagnostic) => diagnostic.severity === "error") ?? flowDiagnostics[0];
    const hasFlowError = flowNotice?.severity === "error";
    // Visão "Visual": card do lead nos gatilhos e celular nas mensagens. Na visão de ícones nada muda.
    const viewMode = useAtomValue(editorViewModeAtom);
    const isRichView = viewMode === "rich";
    // O contorno tracejado faz o papel da borda nas duas visões; do andamento só fica o que está acontecendo agora.
    const runStatus = status === "loading" || status === "success" ? status : "initial";
    const connectionHover = useAtomValue(connectionHoverAtom);
    const showsRichPreview = isRichView && hasRichPreview(nodeType);
    const isBlockedByFlowProblem = useIsNodeBlockedByFlowProblem(id);
    const { inputSide, outputSide } = readNodeSides(nodeData);
    const updateNodeInternals = useUpdateNodeInternals();
    const changeSide = (end: "inputSide" | "outputSide") => {
      const sides = readNodeSides(nodeData);
      const changedSide = end === "inputSide" ? nextSide(sides.inputSide, sides.outputSide) : nextSide(sides.outputSide, sides.inputSide);
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ui: { ...sides, [end]: changedSide } } } : node,
        ),
      );
    };
    // O React Flow só recalcula onde a ligação encosta quando avisado de que a alça mudou de lugar.
    useEffect(() => {
      updateNodeInternals(id);
    }, [id, inputSide, outputSide, updateNodeInternals]);
    const outlineTone: OutlineTone = flowNotice || isBlockedByFlowProblem ? "problem" : "ok";
    const nodeInvalid = !!(validation && !validation.valid && !validation.skip);
    // `needsReview` no node.data sinaliza pendência da IA generativa —
    // user precisa abrir o nó pra completar (ex: escolher produto/agenda).
    // Mesma cor de erro de validação (borda vermelha pulsante).
    const needsReview = !!(nodeData?.needsReview === true);
    // Sobrescreve status quando validação falha — borda vermelha pulsante
    // sinaliza que o trigger não está pronto pra ativar.
    const effectiveStatus: typeof status =
      nodeInvalid || hasGraphError || hasFlowError || needsReview ? "error" : status;

    // ── Step-by-Step overlay ───────────────────────────────────
    const stepState = useAtomValue(stepByStepStateAtom);
    const stepNodeStatus = stepState.active
      ? (stepState.nodeStatuses[id] ?? "idle")
      : "idle";
    const handleRocketClick = () => {
      window.dispatchEvent(
        new CustomEvent("step-by-step:open-popover", { detail: { nodeId: id } }),
      );
    };

    return (
      <WorkflowNode
        name={name}
        description={description}
        showToolbar={!isReadOnly}
        onDelete={handleDelete}
        onSettings={isReadOnly ? undefined : onSettings}
        notice={isRichView ? undefined : flowNotice}
        onDuplicate={handleDuplicate}
        caption={!isRichView && nodeType && hasIconCaption(nodeType) ? <IconNodeCaption nodeType={nodeType} data={nodeData} /> : undefined}
        onCycleOutputSide={() => changeSide("outputSide")}
        onAddNext={handleAddNext}
      >
        <StepRocketOverlay status={stepNodeStatus} onClick={handleRocketClick} />
        <NodeStatusIndicator
          status={runStatus}
          variant="border"
          className="rounded-l-2xl"
        >
          <BaseNode
            status={status}
            // Na visão "Visual" o alerta do canto já explica o problema: o balão escuro ficaria repetido.
            validation={isRichView ? undefined : validation}
            graphErrorMessages={isRichView ? [] : [
              ...graphIssues
                .filter((i) => i.severity === "error")
                .map((i) => i.message),
              ...flowDiagnostics
                .filter((diagnostic) => diagnostic.severity === "error")
                .map((diagnostic) => diagnostic.message),
              ...(needsReview
                ? [
                    `🤖 IA marcou pra revisão: ${
                      (nodeData as { reviewReason?: string })?.reviewReason ??
                      "configurar campos faltantes"
                    }`,
                  ]
                : []),
            ]}
            onDoubleClick={isReadOnly ? undefined : onDoubleClick}
            className="relative group rounded-2xl border-transparent outline-none hover:bg-card hover:ring-0 focus:ring-0"
          >
            <BaseNodeContent className={showsRichPreview ? "relative p-1" : "relative"}>
              <AnimatedOutline tone={outlineTone} radius={showsRichPreview ? 16 : 20} />
              {connectionHover?.nodeId === id && connectionHover.isAllowed && (
                <span className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-info/15">
                  <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-info text-white shadow-[0_0_10px_var(--info)]">
                    <PlusIcon className="size-4" strokeWidth={3} />
                  </span>
                </span>
              )}
              {isRichView && flowNotice && <FlowNoticeBadge notice={flowNotice} onFix={isReadOnly ? undefined : onSettings} />}
              {showsRichPreview && nodeType ? (
                <RichNodePreview nodeType={nodeType} data={nodeData} name={name} icon={Icon} isUndelivered={hasFlowError} />
              ) : !isRichView && nodeType && hasIconGlyph(nodeType) ? (
                <IconNodeGlyph nodeType={nodeType} data={nodeData} />
              ) : typeof Icon === "string" ? (
                <Image src={Icon} alt={name} width={16} height={16} />
              ) : (
                <Icon className="size-4 text-muted-foreground" />
              )}
              {children}
              {/* <BaseHandle
                id="source-1"
                type="source"
                position={Position.Right}
              /> */}
              <NodeSelector
                open={openSelector}
                onOpenChange={setOpenSelector}
                sourceId={id}
              >
                <ButtonHandle
                  id="source-1"
                  type="source"
                  position={toPosition(outputSide)}
                  showButton={shouldShowButton}
                >
                  <AddNextNodeButton />
                </ButtonHandle>
              </NodeSelector>
            </BaseNodeContent>
          </BaseNode>
        </NodeStatusIndicator>
      </WorkflowNode>
    );
  },
);

BaseTriggerNode.displayName = "BaseTriggerNode";
