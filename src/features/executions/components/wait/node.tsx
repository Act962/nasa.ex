"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { TimerIcon } from "lucide-react";
import { WaitDialog, WaitFormValues } from "./dialog";

type WaitNodeData = {
  action?: WaitFormValues;
};

type WaitNodeType = Node<WaitNodeData>;

export const WaitNode = memo((props: NodeProps<WaitNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = "initial";

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: WaitFormValues) => {
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
      <WaitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={TimerIcon}
        name="Esperar"
        status={nodeStatus}
        description="Espera um tempo antes de continuar"
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

WaitNode.displayName = "WaitNode";
