"use client";

import {
  ConnectionState,
  type NodeProps,
  Position,
  useConnection,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { LucideIcon, Plus } from "lucide-react";
import { createId } from "@paralleldrive/cuid2";
import { memo, useMemo, useState, type ReactNode } from "react";
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
import { ButtonHandle } from "@/components/react-flow/button-handle";
import { Button } from "@/components/ui/button";
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

    const shouldShowButton = !connectionInProgress && !isConnected;

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
    const nodeInvalid = !!(validation && !validation.valid && !validation.skip);
    // `needsReview` no node.data sinaliza pendência da IA generativa —
    // user precisa abrir o nó pra completar (ex: escolher produto/agenda).
    // Mesma cor de erro de validação (borda vermelha pulsante).
    const needsReview = !!(nodeData?.needsReview === true);
    // Sobrescreve status quando validação falha — borda vermelha pulsante
    // sinaliza que o trigger não está pronto pra ativar.
    const effectiveStatus: typeof status =
      nodeInvalid || hasGraphError || needsReview ? "error" : status;

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
        onDelete={handleDelete}
        onSettings={onSettings}
        onDuplicate={handleDuplicate}
        onAddNext={handleAddNext}
      >
        <StepRocketOverlay status={stepNodeStatus} onClick={handleRocketClick} />
        <NodeStatusIndicator
          status={effectiveStatus}
          variant="border"
          className="rounded-l-2xl"
        >
          <BaseNode
            status={status}
            validation={validation}
            graphErrorMessages={[
              ...graphIssues
                .filter((i) => i.severity === "error")
                .map((i) => i.message),
              ...(needsReview
                ? [
                    `🤖 IA marcou pra revisão: ${
                      (nodeData as { reviewReason?: string })?.reviewReason ??
                      "configurar campos faltantes"
                    }`,
                  ]
                : []),
            ]}
            onDoubleClick={onDoubleClick}
            className="rounded-l-2xl relative group"
          >
            <BaseNodeContent>
              {typeof Icon === "string" ? (
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
                  position={Position.Right}
                  showButton={shouldShowButton}
                >
                  <Button
                    className="rounded-[4px] size-4 p-0 has-[>svg]:px-0"
                    variant="secondary"
                  >
                    <Plus className="size-3" />
                  </Button>
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
