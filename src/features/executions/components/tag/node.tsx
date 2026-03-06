"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { TagIcon } from "lucide-react";
import { TagDialog, TagFormValues } from "./dialog";
import { useNodeStatus } from "../../hook/use-node-status";
import { TAG_CHANNEL_NAME } from "@/inngest/channels/tag";
import { fetchTagRealtimeToken } from "./actions";

type TagNodeData = {
  action?: TagFormValues;
};

type TagNodeType = Node<TagNodeData>;

export const TagNode = memo((props: NodeProps<TagNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: TAG_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchTagRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: TagFormValues) => {
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
      <TagDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={TagIcon}
        name="Tag"
        status={nodeStatus}
        description="Adiciona/remove uma tag"
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

TagNode.displayName = "TagNode";
