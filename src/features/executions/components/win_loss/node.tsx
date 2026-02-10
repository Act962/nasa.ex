"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { TimerIcon, Trophy } from "lucide-react";
import { WinLossDialog, WinLossFormValues } from "./dialog";

type WinLossNodeData = {
  action?: WinLossFormValues;
};

type WinLossNodeType = Node<WinLossNodeData>;

export const WinLossNode = memo((props: NodeProps<WinLossNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = "initial";

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: WinLossFormValues) => {
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
  // const description = nodeData?.endpoint
  //   ? `${nodeData.method || "GET"}: ${nodeData.endpoint}`
  //   : "Not configured";

  return (
    <>
      <WinLossDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={Trophy}
        name="Ganho/Perdido"
        status={nodeStatus}
        description="Define se o lead foi ganho ou perdido"
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

WinLossNode.displayName = "WinLossNode";
