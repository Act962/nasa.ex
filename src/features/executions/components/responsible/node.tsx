"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { UserRoundPlusIcon } from "lucide-react";
import { ResponsibleDialog, ResponsibleFormValues } from "./dialog";
import { useNodeStatus } from "../../hook/use-node-status";
import { RESPONSIBLE_CHANNEL_NAME } from "@/inngest/channels/responsible";
import { fetchResponsibleRealtimeToken } from "./actions";

type ResponsibleNodeData = {
  action?: ResponsibleFormValues;
};

type ResponsibleNodeType = Node<ResponsibleNodeData>;

export const ResponsibleNode = memo((props: NodeProps<ResponsibleNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: RESPONSIBLE_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchResponsibleRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: ResponsibleFormValues) => {
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
  const actionType =
    nodeData?.action?.type === "REMOVE" ? "Remover" : "Adicionar";
  const responsibleName = nodeData?.action?.responsible?.name || "";

  const description = responsibleName
    ? `${actionType}: ${responsibleName}`
    : "Configurar responsável";

  return (
    <>
      <ResponsibleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={UserRoundPlusIcon}
        name="Responsável"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

ResponsibleNode.displayName = "ResponsibleNode";
