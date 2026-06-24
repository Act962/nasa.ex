"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BaseExecutionNode } from "../base-execution-node";
import { useNodeStatus } from "../../hook/use-node-status";
import { SEND_APP_ACTION_CHANNEL_NAME } from "@/inngest/channels/send-app-action";
import { fetchSendAppActionRealtimeToken } from "./shared-actions";

/**
 * Wrapper de node visual no canvas pras 7 actions "Adicionar Lead no App".
 *
 * Cada action concreta (SendFormNode, SendAgendaNode, etc) chama esse
 * com seu ícone, nome, e renderiza seu próprio dialog via prop
 * `renderDialog(open, onOpenChange, defaultValues, onSubmit)`.
 *
 * Todos compartilham o mesmo channel Realtime
 * (`sendAppActionChannel`) — economiza 1 channel por action.
 */

interface Props<TData extends Record<string, unknown>> {
  nodeProps: NodeProps<Node<TData>>;
  icon: LucideIcon;
  name: string;
  description: string;
  renderDialog: (params: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultValues: TData | undefined;
    onSubmit: (values: TData) => void;
  }) => ReactNode;
}

function BaseSendAppActionNodeInner<TData extends Record<string, unknown>>(
  props: Props<TData>,
) {
  const { nodeProps, icon, name, description, renderDialog } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: nodeProps.id,
    channel: SEND_APP_ACTION_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchSendAppActionRealtimeToken,
  });

  const handleSubmit = (values: TData) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === nodeProps.id
          ? { ...node, data: { ...node.data, ...values } }
          : node,
      ),
    );
    setDialogOpen(false);
  };

  return (
    <>
      {renderDialog({
        open: dialogOpen,
        onOpenChange: setDialogOpen,
        defaultValues: nodeProps.data,
        onSubmit: handleSubmit,
      })}
      <BaseExecutionNode
        {...nodeProps}
        id={nodeProps.id}
        icon={icon}
        name={name}
        status={nodeStatus}
        description={description}
        onSettings={() => setDialogOpen(true)}
        onDoubleClick={() => setDialogOpen(true)}
      />
    </>
  );
}

export const BaseSendAppActionNode = memo(
  BaseSendAppActionNodeInner,
) as typeof BaseSendAppActionNodeInner;
