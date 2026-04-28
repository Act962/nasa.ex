"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { SendIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import { useNodeStatus } from "@/features/executions/hook/use-node-status";
import { WS_SEND_MESSAGE_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsSendMessageToken } from "../../lib/realtime-tokens";
import { WsSendMessageDialog, WsSendMessageFormValues } from "./dialog";

type NodeData = { action?: WsSendMessageFormValues };
type NodeT = Node<NodeData>;

export const WsSendMessageParticipantsNode = memo(
  (props: NodeProps<NodeT>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const status = useNodeStatus({
      nodeId: props.id,
      channel: WS_SEND_MESSAGE_CHANNEL_NAME,
      topic: "status",
      refreshToken: fetchWsSendMessageToken as any,
    });

    const handleSubmit = (values: WsSendMessageFormValues) => {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === props.id
            ? { ...n, data: { ...(n.data as any), action: values } }
            : n,
        ),
      );
    };

    const cfg = props.data?.action;
    const description = cfg
      ? `${cfg.payload.type}${
          cfg.target.sendMode === "CUSTOM" ? " · número customizado" : " · participantes"
        }`
      : "Envia WhatsApp aos participantes";

    return (
      <>
        <WsSendMessageDialog
          open={open}
          onOpenChange={setOpen}
          onSubmit={handleSubmit}
          defaultValues={cfg}
        />
        <WsBaseExecutionNode
          {...props}
          icon={SendIcon}
          name="Mensagem p/ participantes"
          description={description}
          status={status}
          onSettings={() => setOpen(true)}
          onDoubleClick={() => setOpen(true)}
        />
      </>
    );
  },
);

WsSendMessageParticipantsNode.displayName = "WsSendMessageParticipantsNode";
