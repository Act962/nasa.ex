"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { MoveHorizontalIcon } from "lucide-react";
import {
  MoveLeadStatusTriggerDialog,
  MoveLeadStatusTriggerFormValues,
} from "./dialog";

type MoveLeadStatusTriggerNodeData = {
  action?: MoveLeadStatusTriggerFormValues;
};

type MoveLeadStatusTriggerNodeType = Node<MoveLeadStatusTriggerNodeData>;

export const MoveLeadStatusTriggerNode = memo(
  (props: NodeProps<MoveLeadStatusTriggerNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = "initial";

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: MoveLeadStatusTriggerFormValues) => {
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
        <MoveLeadStatusTriggerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={nodeData.action}
        />
        <BaseTriggerNode
          {...props}
          icon={MoveHorizontalIcon}
          name="Mover Lead para Status"
          description="Quando um lead é movido para o status configurado"
          status={nodeStatus}
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);
