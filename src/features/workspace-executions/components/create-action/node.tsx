"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { PlusSquareIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import {
  CreateActionDialog,
  CreateActionFormValues,
} from "./dialog";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_CREATE_ACTION_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsCreateActionToken } from "../../lib/realtime-tokens";

type LegacySingle = {
  title: string;
  description?: string;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  workspaceId?: string;
  columnId: string;
};

type Data = {
  action?: LegacySingle;
  actions?: CreateActionFormValues["actions"];
};

export const WsCreateActionNode = memo((props: NodeProps<Node<Data>>) => {
  const [open, setOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const status = useNodeStatus({
    nodeId: props.id,
    channel: WS_CREATE_ACTION_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchWsCreateActionToken as any,
  });

  const handleSubmit = (v: CreateActionFormValues) =>
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === props.id
          ? {
              ...n,
              data: { ...(n.data as any), actions: v.actions, action: undefined },
            }
          : n,
      ),
    );

  const defaults: CreateActionFormValues = {
    actions:
      props.data?.actions && props.data.actions.length > 0
        ? props.data.actions
        : props.data?.action
          ? [
              {
                title: props.data.action.title,
                description: props.data.action.description,
                priority: props.data.action.priority,
                workspaceId: props.data.action.workspaceId,
                columnId: props.data.action.columnId,
                participants: [],
                subActions: [],
              },
            ]
          : [],
  };

  const description =
    props.data?.actions && props.data.actions.length > 0
      ? props.data.actions.length === 1
        ? props.data.actions[0]?.title || "Configure a nova ação"
        : `${props.data.actions.length} ações`
      : (props.data?.action?.title ?? "Configure a nova ação");

  return (
    <>
      <CreateActionDialog
        open={open}
        onOpenChange={setOpen}
        defaultValues={defaults}
        onSubmit={handleSubmit}
      />
      <WsBaseExecutionNode
        {...props}
        icon={PlusSquareIcon}
        name="Criar ação"
        description={description}
        status={status}
        onSettings={() => setOpen(true)}
        onDoubleClick={() => setOpen(true)}
      />
    </>
  );
});
WsCreateActionNode.displayName = "WsCreateActionNode";
