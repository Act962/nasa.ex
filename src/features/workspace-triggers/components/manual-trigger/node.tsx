"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { MousePointerIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { WsBaseTriggerNode } from "@/features/workspace-triggers/components/base-trigger-node";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_MANUAL_TRIGGER_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsManualTriggerToken } from "@/features/workspace-executions/lib/realtime-tokens";
import {
  WsManualTriggerDialog,
  WsManualTriggerFormValues,
} from "./dialog";

type Data = { action?: WsManualTriggerFormValues };

export const WsManualTriggerNode = memo((props: NodeProps<Node<Data>>) => {
  const [open, setOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const status = useNodeStatus({
    nodeId: props.id,
    channel: WS_MANUAL_TRIGGER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchWsManualTriggerToken as any,
  });

  const handleSubmit = (values: WsManualTriggerFormValues) => {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === props.id
          ? { ...n, data: { ...(n.data as any), action: values } }
          : n,
      ),
    );
  };

  return (
    <>
      <WsManualTriggerDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={handleSubmit}
        defaultValues={props.data?.action}
        workspaceId={workspaceId}
      />
      <WsBaseTriggerNode
        {...props}
        icon={MousePointerIcon}
        name="Gatilho Manual"
        description="Execute manualmente"
        status={status}
        onSettings={() => setOpen(true)}
        onDoubleClick={() => setOpen(true)}
      />
    </>
  );
});

WsManualTriggerNode.displayName = "WsManualTriggerNode";
