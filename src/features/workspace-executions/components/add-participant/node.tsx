"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import {
  AddParticipantDialog,
  AddParticipantFormValues,
} from "./dialog";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_ADD_PARTICIPANT_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsAddParticipantToken } from "../../lib/realtime-tokens";

type LegacyData = { userId?: string; userIds?: string[] };
type WsAddParticipantNodeData = {
  action?: AddParticipantFormValues | LegacyData;
};

type WsAddParticipantNodeType = Node<WsAddParticipantNodeData>;

const normalize = (
  action?: AddParticipantFormValues | LegacyData,
): AddParticipantFormValues => {
  if (!action) return { userIds: [] };
  if ("userIds" in action && Array.isArray(action.userIds))
    return { userIds: action.userIds };
  if ("userId" in action && action.userId)
    return { userIds: [action.userId] };
  return { userIds: [] };
};

export const WsAddParticipantNode = memo(
  (props: NodeProps<WsAddParticipantNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
      nodeId: props.id,
      channel: WS_ADD_PARTICIPANT_CHANNEL_NAME,
      topic: "status",
      refreshToken: fetchWsAddParticipantToken as any,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: AddParticipantFormValues) => {
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
        ? "Adicione um participante à ação"
        : current.userIds.length === 1
          ? "1 participante definido"
          : `${current.userIds.length} participantes definidos`;

    return (
      <>
        <AddParticipantDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={current}
        />
        <WsBaseExecutionNode
          {...props}
          id={props.id}
          icon={UserPlusIcon}
          name="Adicionar participante"
          status={nodeStatus}
          description={description}
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);

WsAddParticipantNode.displayName = "WsAddParticipantNode";
