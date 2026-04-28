"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { UserRoundPlusIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import {
  SetResponsibleDialog,
  SetResponsibleFormValues,
} from "./dialog";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_SET_RESPONSIBLE_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsSetResponsibleToken } from "../../lib/realtime-tokens";

type LegacyData = { userId?: string; userIds?: string[] };
type WsSetResponsibleNodeData = {
  action?: SetResponsibleFormValues | LegacyData;
};

type WsSetResponsibleNodeType = Node<WsSetResponsibleNodeData>;

const normalize = (
  action?: SetResponsibleFormValues | LegacyData,
): SetResponsibleFormValues => {
  if (!action) return { userIds: [] };
  if ("userIds" in action && Array.isArray(action.userIds))
    return { userIds: action.userIds };
  if ("userId" in action && action.userId)
    return { userIds: [action.userId] };
  return { userIds: [] };
};

export const WsSetResponsibleNode = memo(
  (props: NodeProps<WsSetResponsibleNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
      nodeId: props.id,
      channel: WS_SET_RESPONSIBLE_CHANNEL_NAME,
      topic: "status",
      refreshToken: fetchWsSetResponsibleToken as any,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: SetResponsibleFormValues) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === props.id) {
            return {
              ...node,
              data: { ...node.data, action: values },
            };
          }
          return node;
        }),
      );
    };

    const current = normalize(props.data?.action);
    const description =
      current.userIds.length === 0
        ? "Defina um responsável para a ação"
        : current.userIds.length === 1
          ? "1 responsável definido"
          : `${current.userIds.length} responsáveis definidos`;

    return (
      <>
        <SetResponsibleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={current}
        />
        <WsBaseExecutionNode
          {...props}
          id={props.id}
          icon={UserRoundPlusIcon}
          name="Definir responsável"
          status={nodeStatus}
          description={description}
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);

WsSetResponsibleNode.displayName = "WsSetResponsibleNode";
