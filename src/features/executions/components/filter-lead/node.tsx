"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { FunnelIcon, GlobeIcon } from "lucide-react";
import { FilterLeadFormValues, FilterNodeDialog } from "./dialog";
// import { useNodeStatus } from "../../hook/use-node-status";
// import { HTTP_REQUEST_CHANNEL_NAME } from "@/inngest/channels/http-request";
// import { fetchFilterLeadRealtimeToken } from "./actions";

type FilterLeadNodeData = {
  action?: FilterLeadFormValues;
};

type FilterLeadNodeType = Node<FilterLeadNodeData>;

export const FilterLeadNode = memo((props: NodeProps<FilterLeadNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = "initial";

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: FilterLeadFormValues) => {
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
  const description = "Filter lead";

  return (
    <>
      <FilterNodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={FunnelIcon}
        name="Filter Lead"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

FilterLeadNode.displayName = "FilterLeadNode";
