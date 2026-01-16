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
import { memo, useState, type ReactNode } from "react";
import { WorkflowNode } from "@/components/workflow-node";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
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
  }: BaseTriggerNodeProps) => {
    const { setNodes, setEdges } = useReactFlow();
    const [openSelector, setOpenSelector] = useState(false);
    const connectionInProgress = useConnection(selector);
    const isConnected = useStore((state) =>
      state.edges.some(
        (edge) => edge.source === id && edge.sourceHandle === "source-1"
      )
    );

    const shouldShowButton = !connectionInProgress && !isConnected;

    const handleDelete = () => {
      setNodes((currentNodes) => {
        const updateNodes = currentNodes.filter((node) => node.id !== id);
        return updateNodes;
      });

      setEdges((currentEdges) => {
        const updateEdges = currentEdges.filter(
          (edge) => edge.source !== id && edge.target !== id
        );
        return updateEdges;
      });
    };

    return (
      <WorkflowNode
        name={name}
        description={description}
        onDelete={handleDelete}
        onSettings={onSettings}
      >
        <NodeStatusIndicator
          status={status}
          variant="border"
          className="rounded-l-2xl"
        >
          <BaseNode
            status={status}
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
  }
);

BaseTriggerNode.displayName = "BaseTriggerNode";
