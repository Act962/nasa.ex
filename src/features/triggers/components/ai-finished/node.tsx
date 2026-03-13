"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { BotIcon } from "lucide-react";
import { AiFinishedTriggerDialog, AiFinishedTriggerFormValues } from "./dialog";

type AiFinishedTriggerNodeData = {
  action?: AiFinishedTriggerFormValues;
};

type AiFinishedTriggerNodeType = Node<AiFinishedTriggerNodeData>;

export const AiFinishedTriggerNode = memo(
  (props: NodeProps<AiFinishedTriggerNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = "initial";

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: AiFinishedTriggerFormValues) => {
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
        <AiFinishedTriggerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={nodeData.action}
        />
        <BaseTriggerNode
          {...props}
          icon={BotIcon}
          name="Uma IA finalizou o atendimento"
          description="Quando uma IA finalizar um atendimento"
          status={nodeStatus}
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);
