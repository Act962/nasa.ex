"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { ArrowLeftRightIcon } from "lucide-react";
import { MoveLeadDialog, MoveLeadFormValues } from "./dialog";

type MoveLeadNodeData = {
  trackingId: string;
  statusId: string;
};

type MoveLeadNodeType = Node<MoveLeadNodeData>;

export const MoveLeadNode = memo((props: NodeProps<MoveLeadNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = "initial";

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: MoveLeadFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...values,
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
      <MoveLeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={ArrowLeftRightIcon}
        name="Move Lead"
        status={nodeStatus}
        description="Move Lead"
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

MoveLeadNode.displayName = "MoveLeadNode";
