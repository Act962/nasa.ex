"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { MoveHorizontalIcon, TagsIcon } from "lucide-react";
import { LeadTaggedTriggerDialog, LeadTaggedTriggerFormValues } from "./dialog";

type LeadTaggedTriggerNodeData = {
  action?: LeadTaggedTriggerFormValues;
};

type LeadTaggedTriggerNodeType = Node<LeadTaggedTriggerNodeData>;

export const LeadTaggedTriggerNode = memo(
  (props: NodeProps<LeadTaggedTriggerNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = "initial";

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: LeadTaggedTriggerFormValues) => {
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
        <LeadTaggedTriggerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={nodeData.action}
        />
        <BaseTriggerNode
          {...props}
          icon={TagsIcon}
          name="Uma Tag for inserida"
          description="Quando uma Tag for inserida no lead"
          status={nodeStatus}
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);
