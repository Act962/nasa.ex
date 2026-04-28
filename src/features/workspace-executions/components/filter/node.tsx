"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { FunnelIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_FILTER_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsFilterToken } from "../../lib/realtime-tokens";
import { WsFilterDialog, WsFilterFormValues } from "./dialog";

type WsFilterNodeData = {
  action?: WsFilterFormValues;
};

type WsFilterNodeType = Node<WsFilterNodeData>;

export const WsFilterNode = memo((props: NodeProps<WsFilterNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const status = useNodeStatus({
    nodeId: props.id,
    channel: WS_FILTER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchWsFilterToken as any,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: WsFilterFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === props.id
          ? { ...node, data: { ...node.data, action: values } }
          : node,
      ),
    );
  };

  const conditions = props.data?.action?.conditions ?? [];
  const description =
    conditions.length === 0
      ? "Configure as condições do filtro"
      : conditions.length === 1
        ? "1 condição configurada"
        : `${conditions.length} condições configuradas`;

  return (
    <>
      <WsFilterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={props.data?.action}
      />
      <WsBaseExecutionNode
        {...props}
        icon={FunnelIcon}
        name="Filtrar"
        description={description}
        status={status}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});
WsFilterNode.displayName = "WsFilterNode";
