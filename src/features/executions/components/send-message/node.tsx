"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { SendIcon } from "lucide-react";
import { SendMessageDialog, SendMessageFormValues } from "./dialog";

type SendMessageNodeData = {
  action?: SendMessageFormValues;
};

type SendMessageNodeType = Node<SendMessageNodeData>;

export const SendMessageNode = memo((props: NodeProps<SendMessageNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = "initial";

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: SendMessageFormValues) => {
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
  const description = nodeData?.action
    ? `${nodeData.action.payload.type}`
    : "Envia uma mensagem ao lead";

  return (
    <>
      <SendMessageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={SendIcon}
        name="Send Message"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

SendMessageNode.displayName = "SendMessageNode";
