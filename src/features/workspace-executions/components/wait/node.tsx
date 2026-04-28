"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { TimerIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import { WsWaitDialog, WsWaitFormValues } from "./dialog";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_WAIT_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsWaitToken } from "../../lib/realtime-tokens";

type WsWaitNodeData = {
  action?: WsWaitFormValues;
};

type WsWaitNodeType = Node<WsWaitNodeData>;

export const WsWaitNode = memo((props: NodeProps<WsWaitNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: WS_WAIT_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchWsWaitToken as any,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: WsWaitFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              action: values,
            },
          };
        }

        return node;
      }),
    );
  };

  const nodeData = props.data;

  return (
    <>
      <WsWaitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <WsBaseExecutionNode
        {...props}
        id={props.id}
        icon={TimerIcon}
        name="Esperar"
        status={nodeStatus}
        description={"Esperar até"}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

WsWaitNode.displayName = "WsWaitNode";
