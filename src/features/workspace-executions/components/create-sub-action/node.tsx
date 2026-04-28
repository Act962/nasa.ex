"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { ListChecksIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import {
  CreateSubActionDialog,
  CreateSubActionFormValues,
} from "./dialog";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_CREATE_SUB_ACTION_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsCreateSubActionToken } from "../../lib/realtime-tokens";

type LegacySingle = { title: string; description?: string };

type Data = {
  action?: LegacySingle;
  subActions?: CreateSubActionFormValues["subActions"];
};

export const WsCreateSubActionNode = memo(
  (props: NodeProps<Node<Data>>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const status = useNodeStatus({
      nodeId: props.id,
      channel: WS_CREATE_SUB_ACTION_CHANNEL_NAME,
      topic: "status",
      refreshToken: fetchWsCreateSubActionToken as any,
    });

    const handleSubmit = (v: CreateSubActionFormValues) =>
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === props.id
            ? {
                ...n,
                data: {
                  ...(n.data as any),
                  subActions: v.subActions,
                  action: undefined,
                },
              }
            : n,
        ),
      );

    const defaults: CreateSubActionFormValues = {
      subActions:
        props.data?.subActions && props.data.subActions.length > 0
          ? props.data.subActions
          : props.data?.action
            ? [
                {
                  title: props.data.action.title,
                  description: props.data.action.description,
                },
              ]
            : [],
    };

    const description =
      props.data?.subActions && props.data.subActions.length > 0
        ? props.data.subActions.length === 1
          ? props.data.subActions[0]?.title || "Configure a sub-ação"
          : `${props.data.subActions.length} sub-ações`
        : (props.data?.action?.title ?? "Configure a sub-ação");

    return (
      <>
        <CreateSubActionDialog
          open={open}
          onOpenChange={setOpen}
          defaultValues={defaults}
          onSubmit={handleSubmit}
        />
        <WsBaseExecutionNode
          {...props}
          icon={ListChecksIcon}
          name="Criar sub-ação"
          description={description}
          status={status}
          onSettings={() => setOpen(true)}
          onDoubleClick={() => setOpen(true)}
        />
      </>
    );
  },
);
WsCreateSubActionNode.displayName = "WsCreateSubActionNode";
