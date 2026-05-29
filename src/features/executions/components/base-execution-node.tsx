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
import Image from "next/image";
import { BaseHandle } from "@/components/react-flow/base-handle";
import {
  type NodeStatus,
  NodeStatusIndicator,
} from "@/components/react-flow/node-status-indicator";
import { NodeSelector } from "@/components/node-selector";
import { ButtonHandle } from "@/components/react-flow/button-handle";
import { Button } from "@/components/ui/button";

interface BaseExecutionNodeProps extends NodeProps {
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

export const BaseExecutionNode = memo(
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
  }: BaseExecutionNodeProps) => {
    const { setNodes, setEdges } = useReactFlow();
    // Validação automática — type + data vêm via NodeProps spread.
    const nodeType = (rest as any).type as string | undefined;
    const nodeData = (rest as any).data as Record<string, unknown> | undefined;
    const validation = useMemo(
      () => (nodeType ? validateNode(nodeType, nodeData) : undefined),
      [nodeType, nodeData],
    );
    // Issues estruturais (ORPHAN, TAG arquivada, UNREACHABLE, etc) vêm do
    // contexto preenchido pelo `useWorkflowValidation` no editor. Se algum
    // tem severity error, força borda vermelha mesmo que validateNode passe.
    const graphIssues = useNodeIssues(id);
    const hasGraphError = graphIssues.some((i) => i.severity === "error");
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

    // Duplica este nó com offset (mesmo type + data clonada). Não copia
    // conexões — o operador precisa religar manualmente, evita criar
    // arestas duplicadas acidentalmente.
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
          // React Flow gera selected=true se herdar — força false pra não
          // confundir UI.
          selected: false,
          data: JSON.parse(JSON.stringify(original.data ?? {})),
        };
        return [...currentNodes, clone];
      });
    };

    // Abre o NodeSelector já com sourceId apontando pra este nó — ao
    // selecionar um novo type, NodeSelector cria o nó e a conexão
    // sourceId→novo automaticamente.
    const handleAddNext = () => setOpenSelector(true);

    // Validação falhou (não-skip) sobrescreve o status visual pra "error".
    // Operador vê borda vermelha pulsante e sabe que o nó vai derrubar o
    // workflow se ativar. Status de execução real (success/loading) só
    // aparece quando a validação passa. Graph issues (ORPHAN, ARCHIVED_TAG,
    // etc) também forçam erro mesmo se o nó isolado passa.
    const nodeInvalid = !!(validation && !validation.valid && !validation.skip);
    const effectiveStatus: typeof status =
      nodeInvalid || hasGraphError ? "error" : status;

    return (
      <WorkflowNode
        name={name}
        description={description}
        onDelete={handleDelete}
        onSettings={onSettings}
        onDuplicate={handleDuplicate}
        onAddNext={handleAddNext}
      >
        <NodeStatusIndicator status={effectiveStatus} variant="border">
          <BaseNode
            onDoubleClick={onDoubleClick}
            status={status}
            validation={validation}
            graphErrorMessages={graphIssues
              .filter((i) => i.severity === "error")
              .map((i) => i.message)}
          >
            <BaseNodeContent>
              {typeof Icon === "string" ? (
                <Image src={Icon} alt={name} width={16} height={16} />
              ) : (
                <Icon className="size-4 text-muted-foreground" />
              )}
              {children}
              <BaseHandle
                id="target-1"
                type="target"
                position={Position.Left}
              />
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

BaseExecutionNode.displayName = "BaseExecutionNode";
