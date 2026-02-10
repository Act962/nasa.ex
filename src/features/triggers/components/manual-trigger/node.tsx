"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { MousePointerIcon } from "lucide-react";
import { ManualTriggerDialog, ManualTriggerFormValues } from "./dialog";

type ManualTriggerNodeData = {
  action?: ManualTriggerFormValues;
};

type ManualTriggerNodeType = Node<ManualTriggerNodeData>;

export const ManualTriggerNode = memo(
  (props: NodeProps<ManualTriggerNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = "initial";

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: ManualTriggerFormValues) => {
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
        <ManualTriggerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={nodeData.action}
        />
        <BaseTriggerNode
          {...props}
          icon={MousePointerIcon}
          name="Ao clicar em 'Executar workflow'"
          status={nodeStatus}
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);
